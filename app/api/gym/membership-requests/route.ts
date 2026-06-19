import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session || !session.gymId) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (session.role === "MEMBER") {
      const requests = await sql`
        select
          mr.id,
          mr.status,
          mr.notes,
          mr.created_at,
          mp.name as plan_name,
          mp.duration_days,
          mp.price,
          mp.schedule
        from membership_requests mr
        join membership_plans mp on mp.id = mr.plan_id
        where mr.member_id = ${session.userId}
        order by mr.created_at desc
      `;

      return NextResponse.json({
        ok: true,
        data: requests,
      });
    }

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const requests = await sql`
      select
        mr.id,
        mr.status,
        mr.notes,
        mr.created_at,
        u.full_name as member_name,
        u.username,
        mp.name as plan_name,
        mp.duration_days,
        mp.price,
        mp.schedule
      from membership_requests mr
      join users u on u.id = mr.member_id
      join membership_plans mp on mp.id = mr.plan_id
      where mr.gym_id = ${session.gymId}
      order by mr.created_at desc
    `;

    return NextResponse.json({
      ok: true,
      data: requests,
    });
  } catch (error) {
    console.error("Error obteniendo solicitudes:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo solicitudes",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || !session.gymId) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (session.role !== "MEMBER") {
      return NextResponse.json(
        {
          ok: false,
          message: "Solo los miembros pueden solicitar membresías",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const planId = String(body.planId || "").trim();
    const notes = String(body.notes || "").trim();

    if (!planId) {
      return NextResponse.json(
        { ok: false, message: "Selecciona una membresía" },
        { status: 400 }
      );
    }

    const gym = await sql`
      select id, status
      from gyms
      where id = ${session.gymId}
      limit 1
    `;

    if (gym.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Gimnasio no encontrado" },
        { status: 404 }
      );
    }

    if (gym[0].status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, message: "El gimnasio no está activo" },
        { status: 403 }
      );
    }

    const member = await sql`
      select id
      from users
      where id = ${session.userId}
        and gym_id = ${session.gymId}
        and role = 'MEMBER'
        and status = 'ACTIVE'
      limit 1
    `;

    if (member.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tu usuario no está activo como miembro del gimnasio",
        },
        { status: 403 }
      );
    }

    const plan = await sql`
      select id
      from membership_plans
      where id = ${planId}
        and gym_id = ${session.gymId}
        and is_active = true
      limit 1
    `;

    if (plan.length === 0) {
      return NextResponse.json(
        { ok: false, message: "La membresía seleccionada no está disponible" },
        { status: 400 }
      );
    }

    const pending = await sql`
      select id
      from membership_requests
      where member_id = ${session.userId}
        and status = 'PENDING'
      limit 1
    `;

    if (pending.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya tienes una solicitud pendiente",
        },
        { status: 409 }
      );
    }

    const membershipRequest = await sql`
      insert into membership_requests (
        gym_id,
        member_id,
        plan_id,
        status,
        notes
      )
      values (
        ${session.gymId},
        ${session.userId},
        ${planId},
        'PENDING',
        ${notes || "Solicitud enviada desde el panel del usuario. Pago en local."}
      )
      returning
        id,
        gym_id,
        member_id,
        plan_id,
        status,
        notes,
        created_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Solicitud enviada correctamente",
      request: membershipRequest[0],
    });
  } catch (error) {
    console.error("Error creando solicitud:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error creando solicitud",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || !session.gymId) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const requestId = url.searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID de la solicitud" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const action = String(body.action || "").toUpperCase();

    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { ok: false, message: "Acción no válida" },
        { status: 400 }
      );
    }

    const requestResult = await sql`
      select
        mr.id,
        mr.gym_id,
        mr.member_id,
        mr.plan_id,
        mr.status,
        u.full_name as member_name,
        mp.name as plan_name,
        mp.duration_days
      from membership_requests mr
      join users u on u.id = mr.member_id
      join membership_plans mp on mp.id = mr.plan_id
      where mr.id = ${requestId}
        and mr.gym_id = ${session.gymId}
      limit 1
    `;

    if (requestResult.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    const membershipRequest = requestResult[0];

    if (membershipRequest.status !== "PENDING") {
      return NextResponse.json(
        { ok: false, message: "Esta solicitud ya fue revisada" },
        { status: 400 }
      );
    }

    if (action === "REJECT") {
      await sql`
        update membership_requests
        set
          status = 'REJECTED',
          reviewed_by = ${session.userId},
          reviewed_at = now(),
          updated_at = now()
        where id = ${requestId}
          and gym_id = ${session.gymId}
      `;

      return NextResponse.json({
        ok: true,
        message: "Solicitud rechazada correctamente",
      });
    }

    await sql`
      update memberships
      set
        status = 'CANCELLED',
        updated_at = now()
      where gym_id = ${session.gymId}
        and member_id = ${membershipRequest.member_id}
        and status in ('ACTIVE', 'ABOUT_TO_EXPIRE')
    `;

    const membership = await sql`
      insert into memberships (
        gym_id,
        member_id,
        plan_id,
        start_date,
        end_date,
        status,
        created_by,
        notes
      )
      values (
        ${session.gymId},
        ${membershipRequest.member_id},
        ${membershipRequest.plan_id},
        current_date,
        current_date + ${membershipRequest.duration_days}::int,
        'ACTIVE',
        ${session.userId},
        'Membresía aprobada desde solicitud del usuario. Pago en local.'
      )
      returning
        id,
        gym_id,
        member_id,
        plan_id,
        start_date,
        end_date,
        status
    `;

    await sql`
      update membership_requests
      set
        status = 'APPROVED',
        reviewed_by = ${session.userId},
        reviewed_at = now(),
        updated_at = now()
      where id = ${requestId}
        and gym_id = ${session.gymId}
    `;

    return NextResponse.json({
      ok: true,
      message: "Solicitud aprobada y membresía asignada correctamente",
      membership: membership[0],
    });
  } catch (error) {
    console.error("Error revisando solicitud:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error revisando solicitud",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}