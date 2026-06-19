import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session || !session.gymId) {
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

    const plans = await sql`
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
        message: "Error obteniendo planes",
        error: getErrorMessage(error),
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

    if (session.role !== "GYM_ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          message: "Solo el administrador del gimnasio puede crear planes",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = cleanString(body.name);
    const durationDays = cleanNumber(body.durationDays);
    const price = cleanNumber(body.price);
    const schedule = cleanString(body.schedule);

    if (!name) {
      return NextResponse.json(
        { ok: false, message: "El nombre del plan es obligatorio" },
        { status: 400 }
      );
    }

    if (durationDays <= 0) {
      return NextResponse.json(
        { ok: false, message: "La duración debe ser mayor a 0 días" },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { ok: false, message: "El precio no puede ser negativo" },
        { status: 400 }
      );
    }

    const existingPlan = await sql`
      select id
      from membership_plans
      where gym_id = ${session.gymId}
        and lower(name) = ${name.toLowerCase()}
      limit 1
    `;

    if (existingPlan.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ya existe un plan con ese nombre" },
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
        message: "Error creando plan",
        error: getErrorMessage(error),
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

    if (session.role !== "GYM_ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          message: "Solo el administrador puede editar planes",
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const planId = url.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del plan" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const name = cleanString(body.name);
    const durationDays = cleanNumber(body.durationDays);
    const price = cleanNumber(body.price);
    const schedule = cleanString(body.schedule);
    const isActive = Boolean(body.isActive);

    if (!name) {
      return NextResponse.json(
        { ok: false, message: "El nombre del plan es obligatorio" },
        { status: 400 }
      );
    }

    if (durationDays <= 0) {
      return NextResponse.json(
        { ok: false, message: "La duración debe ser mayor a 0 días" },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { ok: false, message: "El precio no puede ser negativo" },
        { status: 400 }
      );
    }

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
        { ok: false, message: "Ya existe otro plan con ese nombre" },
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
        message: "Error editando plan",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || !session.gymId) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (session.role !== "GYM_ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          message: "Solo el administrador puede eliminar planes",
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const planId = url.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del plan" },
        { status: 400 }
      );
    }

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
        message: "Error eliminando plan",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}