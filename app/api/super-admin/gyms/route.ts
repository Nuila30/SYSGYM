import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          message: "No autenticado",
        },
        { status: 401 }
      );
    }

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          message: "No autorizado",
        },
        { status: 403 }
      );
    }

    const gyms = await sql`
      select
        g.id,
        g.name,
        g.phone,
        g.email,
        g.address,
        g.status,
        g.created_at,
        ss.plan_name,
        ss.monthly_fee,
        ss.end_date as subscription_end_date,
        ss.status as subscription_status
      from gyms g
      left join system_subscriptions ss on ss.gym_id = g.id
      order by g.created_at desc
    `;

    return NextResponse.json({
      ok: true,
      data: gyms,
    });
  } catch (error) {
    console.error("Error obteniendo gimnasios:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo gimnasios",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          message: "No autenticado",
        },
        { status: 401 }
      );
    }

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          message: "No autorizado",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const gymName = String(body.gymName || "").trim();
    const gymPhone = String(body.gymPhone || "").trim();
    const gymEmail = String(body.gymEmail || "").trim().toLowerCase();
    const gymAddress = String(body.gymAddress || "").trim();

    const adminFullName = String(body.adminFullName || "").trim();
    const adminUsername = String(body.adminUsername || "").trim().toLowerCase();
    const adminEmail = String(body.adminEmail || "").trim().toLowerCase();
    const adminPassword = String(body.adminPassword || "");

    const planName = String(body.planName || "Plan Mensual").trim();
    const monthlyFee = Number(body.monthlyFee || 0);
    const subscriptionDays = Number(body.subscriptionDays || 30);

    if (!gymName) {
      return NextResponse.json(
        {
          ok: false,
          message: "El nombre del gimnasio es obligatorio",
        },
        { status: 400 }
      );
    }

    if (!adminFullName || !adminUsername || !adminEmail || !adminPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Los datos del administrador del gimnasio son obligatorios",
        },
        { status: 400 }
      );
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          message: "La contraseña debe tener al menos 8 caracteres",
        },
        { status: 400 }
      );
    }

    if (subscriptionDays <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Los días de suscripción deben ser mayores a 0",
        },
        { status: 400 }
      );
    }

    const existingUser = await sql`
      select id from users
      where username = ${adminUsername}
         or email = ${adminEmail}
      limit 1
    `;

    if (existingUser.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya existe un usuario con ese username o correo",
        },
        { status: 409 }
      );
    }

    const gym = await sql`
      insert into gyms (
        name,
        phone,
        email,
        address,
        status
      )
      values (
        ${gymName},
        ${gymPhone || null},
        ${gymEmail || null},
        ${gymAddress || null},
        'ACTIVE'
      )
      returning id, name, phone, email, address, status, created_at
    `;

    const gymId = gym[0].id;

    await sql`
      insert into system_subscriptions (
        gym_id,
        plan_name,
        monthly_fee,
        start_date,
        end_date,
        status
      )
      values (
        ${gymId},
        ${planName},
        ${monthlyFee},
        current_date,
        current_date + ${subscriptionDays}::int,
        'ACTIVE'
      )
    `;

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const gymAdmin = await sql`
      insert into users (
        gym_id,
        full_name,
        username,
        email,
        password_hash,
        role,
        status,
        registered_by
      )
      values (
        ${gymId},
        ${adminFullName},
        ${adminUsername},
        ${adminEmail},
        ${passwordHash},
        'GYM_ADMIN',
        'ACTIVE',
        ${session.userId}
      )
      returning id, gym_id, full_name, username, email, role, status, created_at
    `;

    await sql`
      insert into audit_logs (
        gym_id,
        user_id,
        action,
        module,
        description
      )
      values (
        ${gymId},
        ${session.userId},
        'CREATE_GYM',
        'GYMS',
        ${"Se creó el gimnasio " + gymName}
      )
    `;

    return NextResponse.json({
      ok: true,
      message: "Gimnasio registrado correctamente",
      gym: gym[0],
      gymAdmin: gymAdmin[0],
    });
  } catch (error) {
    console.error("Error registrando gimnasio:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error registrando gimnasio",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}