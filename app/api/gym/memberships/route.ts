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

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const memberships = await sql`
      select
        m.id,
        m.member_id,
        u.full_name as member_name,
        u.username,
        mp.name as plan_name,
        mp.schedule,
        m.start_date,
        m.end_date,
        m.status,
        m.created_at
      from memberships m
      join users u on u.id = m.member_id
      left join membership_plans mp on mp.id = m.plan_id
      where m.gym_id = ${session.gymId}
      order by m.created_at desc
    `;

    return NextResponse.json({
      ok: true,
      data: memberships,
    });
  } catch (error) {
    console.error("Error obteniendo membresías:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo membresías",
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

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const memberId = String(body.memberId || "");
    const planId = String(body.planId || "");
    const notes = String(body.notes || "").trim();

    if (!memberId || !planId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Miembro y plan son obligatorios",
        },
        { status: 400 }
      );
    }

    const member = await sql`
      select id, full_name
      from users
      where id = ${memberId}
        and gym_id = ${session.gymId}
        and role = 'MEMBER'
      limit 1
    `;

    if (member.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "El usuario seleccionado no es miembro del gimnasio",
        },
        { status: 400 }
      );
    }

    const plan = await sql`
      select id, name, duration_days
      from membership_plans
      where id = ${planId}
        and gym_id = ${session.gymId}
        and is_active = true
      limit 1
    `;

    if (plan.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "El plan seleccionado no existe o está inactivo",
        },
        { status: 400 }
      );
    }

    await sql`
      update memberships
      set status = 'CANCELLED',
          updated_at = now()
      where gym_id = ${session.gymId}
        and member_id = ${memberId}
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
        ${memberId},
        ${planId},
        current_date,
        current_date + ${plan[0].duration_days}::int,
        'ACTIVE',
        ${session.userId},
        ${notes || null}
      )
      returning id, member_id, plan_id, start_date, end_date, status
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
        ${session.gymId},
        ${session.userId},
        'ASSIGN_MEMBERSHIP',
        'MEMBERSHIPS',
        ${"Se asignó el plan " + plan[0].name + " al miembro " + member[0].full_name}
      )
    `;

    return NextResponse.json({
      ok: true,
      message: "Membresía asignada correctamente",
      membership: membership[0],
    });
  } catch (error) {
    console.error("Error asignando membresía:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error asignando membresía",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}