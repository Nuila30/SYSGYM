import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  cleanString,
  cleanNumber,
  cleanInteger,
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

async function getCurrentGymSession() {
  const session = await getCurrentSession();

  if (!session || !session.gymId) {
    return null;
  }

  return session;
}

async function requireGymAdmin() {
  const session = await getCurrentSession();

  if (!session || !session.gymId) {
    return null;
  }

  if (session.role !== "GYM_ADMIN") {
    return null;
  }

  return session;
}

function validatePlanId(value: string | null) {
  const planId = cleanString(value);
  const errors: FieldErrors = {};

  if (!planId) {
    errors.planId = "Falta el ID del plan";
  } else if (!isValidUuid(planId)) {
    errors.planId = "ID de plan inválido";
  }

  return {
    ok: Object.keys(errors).length === 0,
    planId,
    errors,
  };
}

type MembershipPlanPayload = {
  name: string;
  durationDays: number;
  price: number;
  schedule: string;
  isActive: boolean;
};

function validateMembershipPlanPayload(body: any, mode: "create" | "edit") {
  const data: MembershipPlanPayload = {
    name: cleanString(body.name),
    durationDays: cleanInteger(body.durationDays),
    price: cleanNumber(body.price),
    schedule: cleanString(body.schedule),
    isActive:
      mode === "create"
        ? true
        : typeof body.isActive === "boolean"
        ? body.isActive
        : Boolean(body.isActive),
  };

  const errors: FieldErrors = {};

  if (!data.name) {
    errors.name = "El nombre del plan es obligatorio";
  } else if (data.name.length < 3) {
    errors.name = "El nombre debe tener mínimo 3 caracteres";
  }

  if (data.name.length > 80) {
    errors.name = "El nombre no puede superar 80 caracteres";
  }

  if (data.durationDays <= 0) {
    errors.durationDays = "La duración debe ser mayor a 0 días";
  }

  if (!Number.isInteger(data.durationDays)) {
    errors.durationDays = "La duración debe ser un número entero";
  }

  if (data.durationDays > 3650) {
    errors.durationDays = "La duración no puede superar 3650 días";
  }

  if (data.price < 0) {
    errors.price = "El precio no puede ser negativo";
  }

  if (data.price > 999999) {
    errors.price = "El precio es demasiado alto";
  }

  if (data.schedule.length > 300) {
    errors.schedule = "El horario no puede superar 300 caracteres";
  }

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

export async function GET() {
  try {
    const session = await getCurrentGymSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (!["GYM_ADMIN", "EMPLOYEE", "MEMBER"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const plans =
      session.role === "MEMBER"
        ? await sql`
            select
              id,
              gym_id,
              name,
              duration_days,
              price,
              schedule,
              is_active,
              created_at
            from membership_plans
            where gym_id = ${session.gymId}
              and is_active = true
            order by duration_days asc, created_at desc
          `
        : await sql`
            select
              id,
              gym_id,
              name,
              duration_days,
              price,
              schedule,
              is_active,
              created_at
            from membership_plans
            where gym_id = ${session.gymId}
            order by duration_days asc, created_at desc
          `;

    return NextResponse.json({
      ok: true,
      data: plans,
    });
  } catch (error) {
    console.error("Error obteniendo planes:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo planes: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGymAdmin();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          message: "Solo el administrador del gimnasio puede crear planes",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const validation = validateMembershipPlanPayload(body, "create");

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { name, durationDays, price, schedule } = validation.data;

    const existingPlan = await sql`
      select id
      from membership_plans
      where gym_id = ${session.gymId}
        and lower(name) = ${name.toLowerCase()}
      limit 1
    `;

    if (existingPlan.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya existe un plan con ese nombre",
          errors: {
            name: "Ya existe un plan con ese nombre",
          },
        },
        { status: 409 }
      );
    }

    const plan = await sql`
      insert into membership_plans (
        gym_id,
        name,
        duration_days,
        price,
        schedule,
        is_active
      )
      values (
        ${session.gymId},
        ${name},
        ${durationDays},
        ${price},
        ${schedule || "Consultar horarios disponibles en el local"},
        true
      )
      returning
        id,
        gym_id,
        name,
        duration_days,
        price,
        schedule,
        is_active,
        created_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Plan creado correctamente",
      plan: plan[0],
    });
  } catch (error) {
    console.error("Error creando plan:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error creando plan: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireGymAdmin();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          message: "Solo el administrador puede editar planes",
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const planIdValidation = validatePlanId(url.searchParams.get("planId"));

    if (!planIdValidation.ok) {
      return validationResponse(planIdValidation.errors);
    }

    const planId = planIdValidation.planId;

    const body = await request.json();

    const validation = validateMembershipPlanPayload(body, "edit");

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { name, durationDays, price, schedule, isActive } = validation.data;

    const planExists = await sql`
      select id
      from membership_plans
      where id = ${planId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (planExists.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Plan no encontrado" },
        { status: 404 }
      );
    }

    const duplicatedPlan = await sql`
      select id
      from membership_plans
      where gym_id = ${session.gymId}
        and lower(name) = ${name.toLowerCase()}
        and id <> ${planId}
      limit 1
    `;

    if (duplicatedPlan.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya existe otro plan con ese nombre",
          errors: {
            name: "Ya existe otro plan con ese nombre",
          },
        },
        { status: 409 }
      );
    }

    const plan = await sql`
      update membership_plans
      set
        name = ${name},
        duration_days = ${durationDays},
        price = ${price},
        schedule = ${schedule || "Consultar horarios disponibles en el local"},
        is_active = ${isActive}
      where id = ${planId}
        and gym_id = ${session.gymId}
      returning
        id,
        gym_id,
        name,
        duration_days,
        price,
        schedule,
        is_active,
        created_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Plan actualizado correctamente",
      plan: plan[0],
    });
  } catch (error) {
    console.error("Error editando plan:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error editando plan: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireGymAdmin();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          message: "Solo el administrador puede eliminar planes",
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const planIdValidation = validatePlanId(url.searchParams.get("planId"));

    if (!planIdValidation.ok) {
      return validationResponse(planIdValidation.errors);
    }

    const planId = planIdValidation.planId;

    const plan = await sql`
      select id, name
      from membership_plans
      where id = ${planId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (plan.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Plan no encontrado" },
        { status: 404 }
      );
    }

    const membershipsUsingPlan = await sql`
      select id
      from memberships
      where plan_id = ${planId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (membershipsUsingPlan.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No puedes eliminar este plan porque ya tiene membresías asociadas. Puedes desactivarlo editando su estado.",
        },
        { status: 409 }
      );
    }

    const requestsUsingPlan = await sql`
      select id
      from membership_requests
      where plan_id = ${planId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (requestsUsingPlan.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No puedes eliminar este plan porque ya tiene solicitudes asociadas. Puedes desactivarlo editando su estado.",
        },
        { status: 409 }
      );
    }

    await sql`
      delete from membership_plans
      where id = ${planId}
        and gym_id = ${session.gymId}
    `;

    return NextResponse.json({
      ok: true,
      message: "Plan eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando plan:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error eliminando plan: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}