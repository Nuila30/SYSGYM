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

function normalizePaymentMethod(value: string) {
  const method = value.toUpperCase();

  if (["CASH", "CARD", "TRANSFER", "OTHER"].includes(method)) {
    return method;
  }

  return "CASH";
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

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const payments = await sql`
      select
        p.id,
        p.gym_id,
        p.membership_id,
        p.member_id,
        p.amount,
        p.method,
        p.reference_code,
        p.notes,
        p.payment_date,
        p.status,
        p.created_at,
        u.full_name as member_name,
        u.username,
        mp.name as plan_name
      from payments p
      join users u on u.id = p.member_id
      left join memberships m on m.id = p.membership_id
      left join membership_plans mp on mp.id = m.plan_id
      where p.gym_id = ${session.gymId}
      order by p.payment_date desc, p.created_at desc
    `;

    return NextResponse.json({
      ok: true,
      data: payments,
    });
  } catch (error) {
    console.error("Error obteniendo pagos:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo pagos",
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

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para registrar pagos" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const membershipId = cleanString(body.membershipId);
    const amount = cleanNumber(body.amount);
    const method = normalizePaymentMethod(cleanString(body.paymentMethod));
    const referenceCode = cleanString(body.referenceCode);
    const notes = cleanString(body.notes);
    const paymentDate =
      cleanString(body.paymentDate) || new Date().toISOString().slice(0, 10);

    if (!membershipId) {
      return NextResponse.json(
        { ok: false, message: "Selecciona una membresía" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { ok: false, message: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    const membership = await sql`
      select
        m.id,
        m.member_id,
        m.gym_id,
        u.full_name as member_name
      from memberships m
      join users u on u.id = m.member_id
      where m.id = ${membershipId}
        and m.gym_id = ${session.gymId}
      limit 1
    `;

    if (membership.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Membresía no encontrada" },
        { status: 404 }
      );
    }

    const payment = await sql`
      insert into payments (
        gym_id,
        membership_id,
        member_id,
        amount,
        method,
        reference_code,
        notes,
        payment_date,
        status,
        created_by
      )
      values (
        ${session.gymId},
        ${membershipId},
        ${membership[0].member_id},
        ${amount},
        ${method},
        ${referenceCode || null},
        ${notes || null},
        ${paymentDate},
        'PAID',
        ${session.userId}
      )
      returning
        id,
        gym_id,
        membership_id,
        member_id,
        amount,
        method,
        reference_code,
        notes,
        payment_date,
        status,
        created_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Pago registrado correctamente",
      payment: payment[0],
    });
  } catch (error) {
    console.error("Error creando pago:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error registrando pago",
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
        { ok: false, message: "Solo el administrador puede editar pagos" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const paymentId = url.searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del pago" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const membershipId = cleanString(body.membershipId);
    const amount = cleanNumber(body.amount);
    const method = normalizePaymentMethod(cleanString(body.paymentMethod));
    const referenceCode = cleanString(body.referenceCode);
    const notes = cleanString(body.notes);
    const paymentDate =
      cleanString(body.paymentDate) || new Date().toISOString().slice(0, 10);

    if (!membershipId) {
      return NextResponse.json(
        { ok: false, message: "Selecciona una membresía" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { ok: false, message: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    const existingPayment = await sql`
      select id
      from payments
      where id = ${paymentId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (existingPayment.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Pago no encontrado" },
        { status: 404 }
      );
    }

    const membership = await sql`
      select id, member_id
      from memberships
      where id = ${membershipId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (membership.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Membresía no encontrada" },
        { status: 404 }
      );
    }

    const payment = await sql`
      update payments
      set
        membership_id = ${membershipId},
        member_id = ${membership[0].member_id},
        amount = ${amount},
        method = ${method},
        reference_code = ${referenceCode || null},
        notes = ${notes || null},
        payment_date = ${paymentDate},
        updated_at = now()
      where id = ${paymentId}
        and gym_id = ${session.gymId}
      returning
        id,
        gym_id,
        membership_id,
        member_id,
        amount,
        method,
        reference_code,
        notes,
        payment_date,
        status,
        created_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Pago actualizado correctamente",
      payment: payment[0],
    });
  } catch (error) {
    console.error("Error editando pago:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error editando pago",
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
        { ok: false, message: "Solo el administrador puede eliminar pagos" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const paymentId = url.searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del pago" },
        { status: 400 }
      );
    }

    const payment = await sql`
      select id
      from payments
      where id = ${paymentId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (payment.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Pago no encontrado" },
        { status: 404 }
      );
    }

    await sql`
      delete from payments
      where id = ${paymentId}
        and gym_id = ${session.gymId}
    `;

    return NextResponse.json({
      ok: true,
      message: "Pago eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando pago:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error eliminando pago",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}