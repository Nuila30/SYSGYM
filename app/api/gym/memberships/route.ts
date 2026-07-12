import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  cleanString,
  isValidUuid,
  type FieldErrors,
} from "@/lib/validacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function validationResponse(errors: FieldErrors) {
  return NextResponse.json(
    {
      ok: false,
      message: "Hay campos inválidos",
      errors,
    },
    { status: 400 }
  );
}

async function getAuthorizedSession() {
  const session = await getCurrentSession();

  if (!session || !session.gymId) {
    return null;
  }

  if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
    return null;
  }

  return session;
}

type MembershipPayload = {
  memberId: string;
  planId: string;
  notes: string;
};

function validateMembershipPayload(body: any) {
  const data: MembershipPayload = {
    memberId: cleanString(body.memberId),
    planId: cleanString(body.planId),
    notes: cleanString(body.notes),
  };

  const errors: FieldErrors = {};

  if (!data.memberId) {
    errors.memberId = "Selecciona un miembro";
  } else if (!isValidUuid(data.memberId)) {
    errors.memberId = "ID de miembro inválido";
  }

  if (!data.planId) {
    errors.planId = "Selecciona un plan de membresía";
  } else if (!isValidUuid(data.planId)) {
    errors.planId = "ID de plan inválido";
  }

  if (data.notes.length > 500) {
    errors.notes = "Las notas no pueden superar 500 caracteres";
  }

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

export async function GET() {
  try {
    const session = await getAuthorizedSession();

    if (!session) {
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
        u.email,
        u.phone,
        mp.id as plan_id,
        mp.name as plan_name,
        mp.schedule,
        mp.duration_days,
        to_char(m.start_date, 'YYYY-MM-DD') as start_date,
        to_char(m.end_date, 'YYYY-MM-DD') as end_date,
        m.status::text as status,
        m.notes,
        m.created_at,
        m.updated_at
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
        message: "Error obteniendo membresías: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthorizedSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const validation = validateMembershipPayload(body);

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { memberId, planId, notes } = validation.data;

    const member = await sql`
      select
        id,
        full_name,
        role::text as role,
        status::text as status
      from users
      where id = ${memberId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (member.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Miembro no encontrado",
          errors: {
            memberId: "Miembro no encontrado",
          },
        },
        { status: 404 }
      );
    }

    if (String(member[0].role) !== "MEMBER") {
      return NextResponse.json(
        {
          ok: false,
          message: "El usuario seleccionado no es un miembro",
          errors: {
            memberId: "El usuario seleccionado no es un miembro",
          },
        },
        { status: 400 }
      );
    }

    if (String(member[0].status) !== "ACTIVE") {
      return NextResponse.json(
        {
          ok: false,
          message: "El miembro seleccionado está inactivo",
          errors: {
            memberId: "El miembro seleccionado está inactivo",
          },
        },
        { status: 400 }
      );
    }

    const plan = await sql`
      select
        id,
        name,
        duration_days,
        is_active
      from membership_plans
      where id = ${planId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (plan.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Plan de membresía no encontrado",
          errors: {
            planId: "Plan de membresía no encontrado",
          },
        },
        { status: 404 }
      );
    }

    if (!plan[0].is_active) {
      return NextResponse.json(
        {
          ok: false,
          message: "El plan seleccionado está inactivo",
          errors: {
            planId: "El plan seleccionado está inactivo",
          },
        },
        { status: 400 }
      );
    }

    const durationDays = Number(plan[0].duration_days || 0);

    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "El plan tiene una duración inválida",
          errors: {
            planId: "El plan tiene una duración inválida",
          },
        },
        { status: 400 }
      );
    }

    await sql`
      update memberships
      set
        status = 'CANCELLED',
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
        notes,
        created_at,
        updated_at
      )
      values (
        ${session.gymId},
        ${memberId},
        ${planId},
        current_date,
        current_date + (${durationDays})::integer,
        'ACTIVE',
        ${session.userId},
        ${notes || null},
        now(),
        now()
      )
      returning
        id,
        gym_id,
        member_id,
        plan_id,
        to_char(start_date, 'YYYY-MM-DD') as start_date,
        to_char(end_date, 'YYYY-MM-DD') as end_date,
        status,
        notes,
        created_at,
        updated_at
    `;

    try {
      await sql`
        insert into audit_logs (
          gym_id,
          user_id,
          action,
          module,
          description,
          created_at
        )
        values (
          ${session.gymId},
          ${session.userId},
          'ASSIGN_MEMBERSHIP',
          'MEMBERSHIPS',
          ${"Se asignó el plan " + plan[0].name + " al miembro " + member[0].full_name},
          now()
        )
      `;
    } catch (auditError) {
      console.error("No se pudo registrar auditoría de membresía:", auditError);
    }

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
        message: "Error asignando membresía: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}