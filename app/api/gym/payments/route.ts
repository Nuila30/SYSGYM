import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  cleanString,
  cleanNumber,
  isValidUuid,
  isValidDate,
  type FieldErrors,
} from "@/lib/validacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER";

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

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const method = cleanString(value).toUpperCase();

  if (["CASH", "CARD", "TRANSFER", "OTHER"].includes(method)) {
    return method as PaymentMethod;
  }

  return "CASH";
}

async function getAuthorizedPaymentsSession() {
  const session = await getCurrentSession();

  if (!session || !session.gymId) {
    return null;
  }

  if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
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

function validatePaymentId(value: string | null) {
  const paymentId = cleanString(value);
  const errors: FieldErrors = {};

  if (!paymentId) {
    errors.paymentId = "Falta el ID del pago";
  } else if (!isValidUuid(paymentId)) {
    errors.paymentId = "ID de pago inválido";
  }

  return {
    ok: Object.keys(errors).length === 0,
    paymentId,
    errors,
  };
}

type PaymentPayload = {
  membershipId: string;
  amount: number;
  method: PaymentMethod;
  referenceCode: string;
  notes: string;
  paymentDate: string;
};

function validatePaymentPayload(body: any) {
  const rawMethod = body.paymentMethod ?? body.method;

  const data: PaymentPayload = {
    membershipId: cleanString(body.membershipId),
    amount: cleanNumber(body.amount),
    method: normalizePaymentMethod(rawMethod),
    referenceCode: cleanString(body.referenceCode),
    notes: cleanString(body.notes),
    paymentDate: cleanString(body.paymentDate) || todayDateString(),
  };

  const errors: FieldErrors = {};

  if (!data.membershipId) {
    errors.membershipId = "Selecciona una membresía";
  } else if (!isValidUuid(data.membershipId)) {
    errors.membershipId = "ID de membresía inválido";
  }

  if (data.amount <= 0) {
    errors.amount = "El monto debe ser mayor a 0";
  }

  if (data.amount > 999999) {
    errors.amount = "El monto es demasiado alto";
  }

  if (!["CASH", "CARD", "TRANSFER", "OTHER"].includes(data.method)) {
    errors.paymentMethod = "Método de pago inválido";
  }

  if (!data.paymentDate || !isValidDate(data.paymentDate)) {
    errors.paymentDate = "Fecha de pago inválida";
  }

  if (["CARD", "TRANSFER"].includes(data.method) && !data.referenceCode) {
    errors.referenceCode =
      "El código de referencia es obligatorio para pagos con tarjeta o transferencia";
  }

  if (data.referenceCode.length > 80) {
    errors.referenceCode = "La referencia no puede superar 80 caracteres";
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
    const session = await getAuthorizedPaymentsSession();

    if (!session) {
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
        to_char(p.payment_date, 'YYYY-MM-DD') as payment_date,
        p.status,
        p.created_at,
        p.updated_at,
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
        message: "Error obteniendo pagos: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthorizedPaymentsSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para registrar pagos" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const validation = validatePaymentPayload(body);

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { membershipId, amount, method, referenceCode, notes, paymentDate } =
      validation.data;

    const membership = await sql`
      select
        m.id,
        m.member_id,
        m.gym_id,
        m.status::text as status,
        u.full_name as member_name
      from memberships m
      join users u on u.id = m.member_id
      where m.id = ${membershipId}
        and m.gym_id = ${session.gymId}
      limit 1
    `;

    if (membership.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Membresía no encontrada",
          errors: {
            membershipId: "Membresía no encontrada",
          },
        },
        { status: 404 }
      );
    }

    if (String(membership[0].status) === "CANCELLED") {
      return NextResponse.json(
        {
          ok: false,
          message: "No puedes registrar pago a una membresía cancelada",
          errors: {
            membershipId: "No puedes registrar pago a una membresía cancelada",
          },
        },
        { status: 400 }
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
        created_by,
        created_at,
        updated_at
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
        ${session.userId},
        now(),
        now()
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
        to_char(payment_date, 'YYYY-MM-DD') as payment_date,
        status,
        created_at,
        updated_at
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
        message: "Error registrando pago: " + getErrorMessage(error),
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
        { ok: false, message: "Solo el administrador puede editar pagos" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const paymentIdValidation = validatePaymentId(
      url.searchParams.get("paymentId")
    );

    if (!paymentIdValidation.ok) {
      return validationResponse(paymentIdValidation.errors);
    }

    const paymentId = paymentIdValidation.paymentId;

    const body = await request.json();

    const validation = validatePaymentPayload(body);

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { membershipId, amount, method, referenceCode, notes, paymentDate } =
      validation.data;

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
      select
        id,
        member_id,
        status::text as status
      from memberships
      where id = ${membershipId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (membership.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Membresía no encontrada",
          errors: {
            membershipId: "Membresía no encontrada",
          },
        },
        { status: 404 }
      );
    }

    if (String(membership[0].status) === "CANCELLED") {
      return NextResponse.json(
        {
          ok: false,
          message: "No puedes asignar el pago a una membresía cancelada",
          errors: {
            membershipId: "No puedes asignar el pago a una membresía cancelada",
          },
        },
        { status: 400 }
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
        to_char(payment_date, 'YYYY-MM-DD') as payment_date,
        status,
        created_at,
        updated_at
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
        message: "Error editando pago: " + getErrorMessage(error),
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
        { ok: false, message: "Solo el administrador puede eliminar pagos" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const paymentIdValidation = validatePaymentId(
      url.searchParams.get("paymentId")
    );

    if (!paymentIdValidation.ok) {
      return validationResponse(paymentIdValidation.errors);
    }

    const paymentId = paymentIdValidation.paymentId;

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
        message: "Error eliminando pago: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}