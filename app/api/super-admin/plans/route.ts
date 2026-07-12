import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  cleanString,
  isValidUuid,
  validateSystemPlanPayload,
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

function cleanNullableInteger(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text) return null;

  const numberValue = Number(text);

  if (!Number.isFinite(numberValue)) return null;

  const integerValue = Math.trunc(numberValue);

  return integerValue < 0 ? 0 : integerValue;
}

function normalizeTextArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter(Boolean);
  }

  return cleanString(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePlanBody(body: any) {
  return {
    ...body,
    features: normalizeTextArray(body.features),
    restrictions: normalizeTextArray(body.restrictions),
  };
}

async function requireSuperAdmin() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return null;
  }

  return session;
}

function validatePlanId(planId: string | null) {
  const errors: FieldErrors = {};
  const cleanPlanId = cleanString(planId);

  if (!cleanPlanId) {
    errors.planId = "Falta el ID del plan";
  } else if (!isValidUuid(cleanPlanId)) {
    errors.planId = "ID de plan inválido";
  }

  return {
    ok: Object.keys(errors).length === 0,
    planId: cleanPlanId,
    errors,
  };
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

    const plans = await sql`
      select
        id,
        name,
        code,
        monthly_fee,
        access_days,
        description,
        features,
        restrictions,
        max_employees,
        max_members,
        max_products,
        can_use_inventory,
        can_use_sales,
        can_use_attendance,
        can_use_reports,
        is_active,
        created_at,
        updated_at
      from system_plans
      order by monthly_fee asc, created_at asc
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
    const session = await requireSuperAdmin();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const normalizedBody = normalizePlanBody(body);

    const validation = validateSystemPlanPayload(normalizedBody);

    if (!validation.ok || !validation.data) {
      return validationResponse(validation.errors);
    }

    const data = validation.data;

    const maxEmployees = cleanNullableInteger(body.maxEmployees);
    const maxMembers = cleanNullableInteger(body.maxMembers);
    const maxProducts = cleanNullableInteger(body.maxProducts);

    const duplicate = await sql`
      select id
      from system_plans
      where upper(code) = ${data.code}
      limit 1
    `;

    if (duplicate.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya existe un plan con ese código",
          errors: {
            code: "Ya existe un plan con ese código",
          },
        },
        { status: 409 }
      );
    }

    const plan = await sql`
      insert into system_plans (
        name,
        code,
        monthly_fee,
        access_days,
        description,
        features,
        restrictions,
        max_employees,
        max_members,
        max_products,
        can_use_inventory,
        can_use_sales,
        can_use_attendance,
        can_use_reports,
        is_active,
        created_at,
        updated_at
      )
      values (
        ${data.name},
        ${data.code},
        ${data.monthlyFee},
        ${data.accessDays},
        ${data.description || null},
        ${data.features},
        ${data.restrictions},
        ${maxEmployees},
        ${maxMembers},
        ${maxProducts},
        ${data.canUseInventory},
        ${data.canUseSales},
        ${data.canUseAttendance},
        ${data.canUseReports},
        true,
        now(),
        now()
      )
      returning *
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
    const session = await requireSuperAdmin();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
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
    const normalizedBody = normalizePlanBody(body);

    const validation = validateSystemPlanPayload(normalizedBody);

    if (!validation.ok || !validation.data) {
      return validationResponse(validation.errors);
    }

    const data = validation.data;

    const maxEmployees = cleanNullableInteger(body.maxEmployees);
    const maxMembers = cleanNullableInteger(body.maxMembers);
    const maxProducts = cleanNullableInteger(body.maxProducts);

    const existingPlan = await sql`
      select id
      from system_plans
      where id = ${planId}
      limit 1
    `;

    if (existingPlan.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Plan no encontrado" },
        { status: 404 }
      );
    }

    const duplicate = await sql`
      select id
      from system_plans
      where upper(code) = ${data.code}
        and id <> ${planId}
      limit 1
    `;

    if (duplicate.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya existe otro plan con ese código",
          errors: {
            code: "Ya existe otro plan con ese código",
          },
        },
        { status: 409 }
      );
    }

    const plan = await sql`
      update system_plans
      set
        name = ${data.name},
        code = ${data.code},
        monthly_fee = ${data.monthlyFee},
        access_days = ${data.accessDays},
        description = ${data.description || null},
        features = ${data.features},
        restrictions = ${data.restrictions},
        max_employees = ${maxEmployees},
        max_members = ${maxMembers},
        max_products = ${maxProducts},
        can_use_inventory = ${data.canUseInventory},
        can_use_sales = ${data.canUseSales},
        can_use_attendance = ${data.canUseAttendance},
        can_use_reports = ${data.canUseReports},
        is_active = ${data.isActive},
        updated_at = now()
      where id = ${planId}
      returning *
    `;

    return NextResponse.json({
      ok: true,
      message: "Plan actualizado correctamente",
      plan: plan[0],
    });
  } catch (error) {
    console.error("Error actualizando plan:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error actualizando plan: " + getErrorMessage(error),
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
    const planIdValidation = validatePlanId(url.searchParams.get("planId"));

    if (!planIdValidation.ok) {
      return validationResponse(planIdValidation.errors);
    }

    const planId = planIdValidation.planId;

    const existingPlan = await sql`
      select id
      from system_plans
      where id = ${planId}
      limit 1
    `;

    if (existingPlan.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Plan no encontrado" },
        { status: 404 }
      );
    }

    const used = await sql`
      select id
      from system_subscriptions
      where system_plan_id = ${planId}
      limit 1
    `;

    if (used.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No se puede eliminar porque el plan ya está asignado. Puedes desactivarlo.",
        },
        { status: 409 }
      );
    }

    const deleted = await sql`
      delete from system_plans
      where id = ${planId}
      returning id
    `;

    if (deleted.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Plan no encontrado" },
        { status: 404 }
      );
    }

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