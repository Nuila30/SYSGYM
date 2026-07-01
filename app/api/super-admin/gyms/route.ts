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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function cleanAccessDays(value: unknown) {
  const days = Math.trunc(cleanNumber(value || 30));
  return Math.max(1, days);
}

async function requireSuperAdmin() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return null;
  }

  return session;
}

async function cleanupCreatedGym(gymId: string | null) {
  if (!gymId) return;

  try {
    await sql`
      delete from system_subscriptions
      where gym_id = ${gymId}
    `;
  } catch (error) {
    console.error("Error eliminando suscripción temporal:", error);
  }

  try {
    await sql`
      delete from users
      where gym_id = ${gymId}
    `;
  } catch (error) {
    console.error("Error eliminando usuarios temporales:", error);
  }

  try {
    await sql`
      delete from gyms
      where id = ${gymId}
    `;
  } catch (error) {
    console.error("Error eliminando gimnasio temporal:", error);
  }
}

export async function GET() {
  try {
    const session = await requireSuperAdmin();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const gyms = await sql`
      select
        g.id,
        g.name,
        coalesce(g.phone, '') as phone,
        coalesce(g.email, '') as email,
        coalesce(g.address, '') as address,
        g.status::text as status,
        g.created_at,
        ss.system_plan_id,
        coalesce(sp.name, ss.plan_name, 'Plan Mensual') as plan_name,
        coalesce(sp.monthly_fee, ss.monthly_fee, 0) as monthly_fee,
        coalesce(ss.access_days, sp.access_days, 30) as access_days,
        ss.start_date,
        to_char(ss.end_date, 'YYYY-MM-DD') as end_date,
        coalesce(ss.status::text, g.status::text) as subscription_status,
        u.full_name as admin_full_name,
        u.username as admin_username,
        u.email as admin_email
      from gyms g
      left join lateral (
        select
          system_plan_id,
          plan_name,
          monthly_fee,
          access_days,
          start_date,
          end_date,
          status
        from system_subscriptions
        where gym_id = g.id
        order by created_at desc
        limit 1
      ) ss on true
      left join system_plans sp on sp.id = ss.system_plan_id
      left join lateral (
        select
          full_name,
          username,
          email
        from users
        where gym_id = g.id
          and role = 'GYM_ADMIN'
        order by created_at asc
        limit 1
      ) u on true
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
        message: "Error obteniendo gimnasios: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let createdGymId: string | null = null;

  try {
    const session = await requireSuperAdmin();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = cleanString(body.name);
    const phone = cleanString(body.phone);
    const email = cleanEmail(body.email);
    const address = cleanString(body.address);

    const systemPlanId = cleanString(body.systemPlanId);

    const adminFullName = cleanString(body.adminFullName);
    const adminEmail = cleanEmail(body.adminEmail);
    const adminPhone = cleanString(body.adminPhone);

    if (!name || !phone || !email || !address) {
      return NextResponse.json(
        { ok: false, message: "Completa los datos del gimnasio" },
        { status: 400 }
      );
    }

    if (!systemPlanId) {
      return NextResponse.json(
        { ok: false, message: "Selecciona un plan" },
        { status: 400 }
      );
    }

    if (!adminFullName || !adminEmail || !adminPhone) {
      return NextResponse.json(
        { ok: false, message: "Completa los datos del administrador" },
        { status: 400 }
      );
    }

    const plan = await sql`
      select
        id,
        name,
        monthly_fee,
        access_days
      from system_plans
      where id = ${systemPlanId}
        and is_active = true
      limit 1
    `;

    if (plan.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Plan no encontrado o inactivo" },
        { status: 404 }
      );
    }

    const accessDays = cleanAccessDays(plan[0].access_days || 30);

    const existingGymEmail = await sql`
      select id
      from gyms
      where lower(email) = ${email}
      limit 1
    `;

    if (existingGymEmail.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ya existe un gimnasio con ese correo" },
        { status: 409 }
      );
    }

    const existingAdminEmail = await sql`
      select id
      from users
      where lower(email) = ${adminEmail}
      limit 1
    `;

    if (existingAdminEmail.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ya existe un usuario con ese correo" },
        { status: 409 }
      );
    }

    const gym = await sql`
      insert into gyms (
        name,
        phone,
        email,
        address,
        status,
        created_at,
        updated_at
      )
      values (
        ${name},
        ${phone},
        ${email},
        ${address},
        'ACTIVE',
        now(),
        now()
      )
      returning id
    `;

    createdGymId = gym[0].id;

    const username = await generateUniqueUsername(adminFullName, adminPhone);

    const temporaryPassword = generateTemporaryPassword(
      adminFullName,
      adminPhone
    );

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const expiresAt = getTemporaryPasswordExpiration();

    const adminUser = await sql`
      insert into users (
        gym_id,
        full_name,
        username,
        email,
        phone,
        role,
        status,
        password_hash,
        must_change_password,
        temp_password_expires_at,
        credentials_email_sent_at,
        created_at,
        updated_at
      )
      values (
        ${createdGymId},
        ${adminFullName},
        ${username},
        ${adminEmail},
        ${adminPhone},
        'GYM_ADMIN',
        'ACTIVE',
        ${passwordHash},
        true,
        ${expiresAt},
        null,
        now(),
        now()
      )
      returning id, username, email
    `;

    await sql`
      insert into system_subscriptions (
        gym_id,
        system_plan_id,
        plan_name,
        monthly_fee,
        access_days,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      )
      values (
        ${createdGymId},
        ${systemPlanId},
        ${plan[0].name},
        ${plan[0].monthly_fee},
        ${accessDays},
        current_date,
        current_date + (${accessDays})::integer,
        'ACTIVE',
        now(),
        now()
      )
    `;

    try {
      await sendCredentialsEmail({
        to: adminEmail,
        fullName: adminFullName,
        username,
        temporaryPassword,
        expiresAt,
      });
    } catch (error) {
      console.error("No se pudo enviar el correo de credenciales:", error);

      await cleanupCreatedGym(createdGymId);

      return NextResponse.json(
        {
          ok: false,
          message:
            "No se pudo enviar el correo de credenciales. No se registró el gimnasio. Revisa la configuración SMTP.",
          error: getErrorMessage(error),
        },
        { status: 500 }
      );
    }

    try {
      await sql`
        update users
        set
          credentials_email_sent_at = now(),
          updated_at = now()
        where id = ${adminUser[0].id}
      `;
    } catch (error) {
      console.error("Correo enviado, pero no se pudo marcar como enviado:", error);
    }

    return NextResponse.json({
      ok: true,
      message: "Gimnasio registrado y credenciales enviadas correctamente",
      gymId: createdGymId,
      emailSent: true,
    });
  } catch (error) {
    console.error("Error registrando gimnasio:", error);

    await cleanupCreatedGym(createdGymId);

    return NextResponse.json(
      {
        ok: false,
        message: "Error registrando gimnasio: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSuperAdmin();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const gymId = cleanString(body.gymId);
    const name = cleanString(body.name);
    const phone = cleanString(body.phone);
    const email = cleanEmail(body.email);
    const address = cleanString(body.address);

    const systemPlanId = cleanString(body.systemPlanId);
    const planNameFromBody = cleanString(body.planName) || "Plan Mensual";
    const monthlyFeeFromBody = cleanNumber(body.monthlyFee);
    const accessDays = cleanAccessDays(body.accessDays || 30);

    const adminFullName = cleanString(body.adminFullName);
    const adminUsername = cleanString(body.adminUsername);
    const adminEmail = cleanEmail(body.adminEmail);
    const adminPhone = cleanString(body.adminPhone) || phone;

    if (!gymId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del gimnasio" },
        { status: 400 }
      );
    }

    if (!name || !phone || !email || !address) {
      return NextResponse.json(
        { ok: false, message: "Completa los datos del gimnasio" },
        { status: 400 }
      );
    }

    const existingGym = await sql`
      select id
      from gyms
      where id = ${gymId}
      limit 1
    `;

    if (existingGym.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Gimnasio no encontrado" },
        { status: 404 }
      );
    }

    const duplicateGymEmail = await sql`
      select id
      from gyms
      where lower(email) = ${email}
        and id <> ${gymId}
      limit 1
    `;

    if (duplicateGymEmail.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ese correo ya pertenece a otro gimnasio" },
        { status: 409 }
      );
    }

    const plan = systemPlanId
      ? await sql`
          select
            id,
            name,
            monthly_fee,
            access_days
          from system_plans
          where id = ${systemPlanId}
          limit 1
        `
      : [];

    const finalSystemPlanId = plan.length > 0 ? systemPlanId : null;
    const finalPlanName =
      plan.length > 0 ? String(plan[0].name) : planNameFromBody;
    const finalMonthlyFee =
      plan.length > 0
        ? Number(plan[0].monthly_fee || 0)
        : monthlyFeeFromBody;

    await sql`
      update gyms
      set
        name = ${name},
        phone = ${phone},
        email = ${email},
        address = ${address},
        updated_at = now()
      where id = ${gymId}
    `;

    const subscription = await sql`
      select id
      from system_subscriptions
      where gym_id = ${gymId}
      order by created_at desc
      limit 1
    `;

    if (subscription.length === 0) {
      await sql`
        insert into system_subscriptions (
          gym_id,
          system_plan_id,
          plan_name,
          monthly_fee,
          access_days,
          start_date,
          end_date,
          status,
          created_at,
          updated_at
        )
        values (
          ${gymId},
          ${finalSystemPlanId},
          ${finalPlanName},
          ${finalMonthlyFee},
          ${accessDays},
          current_date,
          current_date + (${accessDays})::integer,
          'ACTIVE',
          now(),
          now()
        )
      `;
    } else {
      await sql`
        update system_subscriptions
        set
          system_plan_id = ${finalSystemPlanId},
          plan_name = ${finalPlanName},
          monthly_fee = ${finalMonthlyFee},
          access_days = ${accessDays},
          end_date = current_date + (${accessDays})::integer,
          updated_at = now()
        where id = ${subscription[0].id}
      `;
    }

    if (adminFullName && adminUsername && adminEmail) {
      const existingAdmin = await sql`
        select id
        from users
        where gym_id = ${gymId}
          and role = 'GYM_ADMIN'
        order by created_at asc
        limit 1
      `;

      if (existingAdmin.length > 0) {
        const duplicateUsername = await sql`
          select id
          from users
          where lower(username) = ${adminUsername.toLowerCase()}
            and id <> ${existingAdmin[0].id}
          limit 1
        `;

        if (duplicateUsername.length > 0) {
          return NextResponse.json(
            { ok: false, message: "Ese usuario ya está en uso" },
            { status: 409 }
          );
        }

        const duplicateEmail = await sql`
          select id
          from users
          where lower(email) = ${adminEmail}
            and id <> ${existingAdmin[0].id}
          limit 1
        `;

        if (duplicateEmail.length > 0) {
          return NextResponse.json(
            { ok: false, message: "Ese correo de administrador ya está en uso" },
            { status: 409 }
          );
        }

        await sql`
          update users
          set
            full_name = ${adminFullName},
            username = ${adminUsername},
            email = ${adminEmail},
            phone = ${adminPhone},
            updated_at = now()
          where id = ${existingAdmin[0].id}
        `;
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Gimnasio actualizado correctamente",
    });
  } catch (error) {
    console.error("Error editando gimnasio:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error editando gimnasio: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSuperAdmin();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const gymId = url.searchParams.get("gymId");

    if (!gymId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del gimnasio" },
        { status: 400 }
      );
    }

    await sql`
      delete from system_subscriptions
      where gym_id = ${gymId}
    `;

    await sql`
      delete from users
      where gym_id = ${gymId}
    `;

    const deleted = await sql`
      delete from gyms
      where id = ${gymId}
      returning id
    `;

    if (deleted.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Gimnasio no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Gimnasio eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando gimnasio:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error eliminando gimnasio: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}