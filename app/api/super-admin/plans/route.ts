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

function cleanInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
}

function cleanTextArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanString(item)).filter(Boolean);
  }

  return cleanString(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requireSuperAdmin() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return null;
  }

  return session;
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

    const name = cleanString(body.name);
    const code = cleanString(body.code).toUpperCase();
    const monthlyFee = cleanNumber(body.monthlyFee);
    const accessDays = Math.max(1, Math.trunc(cleanNumber(body.accessDays || 30)));
    const description = cleanString(body.description);
    const features = cleanTextArray(body.features);
    const restrictions = cleanTextArray(body.restrictions);

    const maxEmployees = cleanInteger(body.maxEmployees);
    const maxMembers = cleanInteger(body.maxMembers);
    const maxProducts = cleanInteger(body.maxProducts);

    const canUseInventory = Boolean(body.canUseInventory);
    const canUseSales = Boolean(body.canUseSales);
    const canUseAttendance = Boolean(body.canUseAttendance);
    const canUseReports = Boolean(body.canUseReports);

    if (!name) {
      return NextResponse.json(
        { ok: false, message: "El nombre del plan es obligatorio" },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { ok: false, message: "El código del plan es obligatorio" },
        { status: 400 }
      );
    }

    if (monthlyFee < 0) {
      return NextResponse.json(
        { ok: false, message: "El precio no puede ser negativo" },
        { status: 400 }
      );
    }

    const duplicate = await sql`
      select id
      from system_plans
      where upper(code) = ${code}
      limit 1
    `;

    if (duplicate.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ya existe un plan con ese código" },
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
    ${name},
    ${code},
    ${monthlyFee},
    ${accessDays},
    ${description || null},
    ${features},
    ${restrictions},
    ${maxEmployees},
    ${maxMembers},
    ${maxProducts},
    ${canUseInventory},
    ${canUseSales},
    ${canUseAttendance},
    ${canUseReports},
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
    const planId = url.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del plan" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const name = cleanString(body.name);
    const code = cleanString(body.code).toUpperCase();
    const monthlyFee = cleanNumber(body.monthlyFee);
    const description = cleanString(body.description);
    const features = cleanTextArray(body.features);
    const restrictions = cleanTextArray(body.restrictions);
    const accessDays = Math.max(1, Math.trunc(cleanNumber(body.accessDays || 30)));
    const maxEmployees = cleanInteger(body.maxEmployees);
    const maxMembers = cleanInteger(body.maxMembers);
    const maxProducts = cleanInteger(body.maxProducts);

    const canUseInventory = Boolean(body.canUseInventory);
    const canUseSales = Boolean(body.canUseSales);
    const canUseAttendance = Boolean(body.canUseAttendance);
    const canUseReports = Boolean(body.canUseReports);
    const isActive = Boolean(body.isActive);

    if (!name || !code) {
      return NextResponse.json(
        { ok: false, message: "Nombre y código son obligatorios" },
        { status: 400 }
      );
    }

    const duplicate = await sql`
      select id
      from system_plans
      where upper(code) = ${code}
        and id <> ${planId}
      limit 1
    `;

    if (duplicate.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ya existe otro plan con ese código" },
        { status: 409 }
      );
    }

    const plan = await sql`
  update system_plans
  set
    name = ${name},
    code = ${code},
    monthly_fee = ${monthlyFee},
    access_days = ${accessDays},
    description = ${description || null},
    features = ${features},
    restrictions = ${restrictions},
    max_employees = ${maxEmployees},
    max_members = ${maxMembers},
    max_products = ${maxProducts},
    can_use_inventory = ${canUseInventory},
    can_use_sales = ${canUseSales},
    can_use_attendance = ${canUseAttendance},
    can_use_reports = ${canUseReports},
    is_active = ${isActive},
    updated_at = now()
  where id = ${planId}
  returning *
`;

    if (plan.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Plan no encontrado" },
        { status: 404 }
      );
    }

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
    const planId = url.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del plan" },
        { status: 400 }
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