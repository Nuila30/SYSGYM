import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  generateTemporaryPassword,
  generateUniqueUsername,
  getTemporaryPasswordExpiration,
} from "@/lib/credentials";
import { sendCredentialsEmail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (!session.gymId) {
      return NextResponse.json(
        { ok: false, message: "Usuario sin gimnasio asignado" },
        { status: 403 }
      );
    }

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const gym = await sql`
      select status
      from gyms
      where id = ${session.gymId}
      limit 1
    `;

    if (gym.length === 0 || gym[0].status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, message: "El gimnasio está suspendido" },
        { status: 403 }
      );
    }

    if (session.role === "EMPLOYEE") {
      const users = await sql`
        select
          id,
          full_name,
          username,
          email,
          phone,
          role,
          status,
          must_change_password,
          temp_password_expires_at,
          created_at
        from users
        where gym_id = ${session.gymId}
          and role = 'MEMBER'
        order by created_at desc
      `;

      return NextResponse.json({
        ok: true,
        data: users,
      });
    }

    const users = await sql`
      select
        id,
        full_name,
        username,
        email,
        phone,
        role,
        status,
        must_change_password,
        temp_password_expires_at,
        created_at
      from users
      where gym_id = ${session.gymId}
        and role in ('GYM_ADMIN', 'EMPLOYEE', 'MEMBER')
      order by created_at desc
    `;

    return NextResponse.json({
      ok: true,
      data: users,
    });
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo usuarios",
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
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (!session.gymId) {
      return NextResponse.json(
        { ok: false, message: "Usuario sin gimnasio asignado" },
        { status: 403 }
      );
    }

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const gym = await sql`
      select status
      from gyms
      where id = ${session.gymId}
      limit 1
    `;

    if (gym.length === 0 || gym[0].status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, message: "El gimnasio está suspendido" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const role = String(body.role || "MEMBER").toUpperCase();

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        {
          ok: false,
          message: "Nombre, correo y teléfono son obligatorios",
        },
        { status: 400 }
      );
    }

    if (!["EMPLOYEE", "MEMBER"].includes(role)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Rol no válido",
        },
        { status: 400 }
      );
    }

    if (session.role === "EMPLOYEE" && role !== "MEMBER") {
      return NextResponse.json(
        {
          ok: false,
          message: "El empleado solo puede registrar miembros",
        },
        { status: 403 }
      );
    }

    const existingEmail = await sql`
      select id
      from users
      where email = ${email}
      limit 1
    `;

    if (existingEmail.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya existe un usuario con ese correo",
        },
        { status: 409 }
      );
    }

    const username = await generateUniqueUsername(fullName, phone);
    const temporaryPassword = generateTemporaryPassword();
    const expiresAt = getTemporaryPasswordExpiration();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const newUser = await sql`
      insert into users (
        gym_id,
        full_name,
        username,
        email,
        phone,
        password_hash,
        role,
        status,
        registered_by,
        must_change_password,
        temp_password_expires_at,
        credentials_email_sent_at
      )
      values (
        ${session.gymId},
        ${fullName},
        ${username},
        ${email},
        ${phone},
        ${passwordHash},
        ${role},
        'ACTIVE',
        ${session.userId},
        true,
        ${expiresAt.toISOString()},
        now()
      )
      returning
        id,
        gym_id,
        full_name,
        username,
        email,
        phone,
        role,
        status,
        must_change_password,
        temp_password_expires_at,
        created_at
    `;

    await sendCredentialsEmail({
      to: email,
      fullName,
      username,
      temporaryPassword,
      expiresAt,
    });

    await sql`
      insert into audit_logs (
        gym_id,
        user_id,
        action,
        module,
        description
      )
      values (
        ${session.gymId},
        ${session.userId},
        'CREATE_USER',
        'USERS',
        ${"Se creó el usuario " + username + " con rol " + role}
      )
    `;

    return NextResponse.json({
      ok: true,
      message:
        "Usuario registrado correctamente. Las credenciales fueron enviadas por correo.",
      user: newUser[0],
    });
  } catch (error) {
    console.error("Error registrando usuario:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error registrando usuario",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}