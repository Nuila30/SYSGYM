import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  cleanString,
  cleanNumber,
  cleanInteger,
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

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const method = cleanString(value).toUpperCase();

  if (["CASH", "CARD", "TRANSFER", "OTHER"].includes(method)) {
    return method as PaymentMethod;
  }

  return "CASH";
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function getAuthorizedSalesSession() {
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

async function prepareSalesDatabase() {
  await sql`
    drop function if exists discount_stock_after_sale_item() cascade
  `;

  await sql`
    create table if not exists sale_items (
      id uuid primary key default gen_random_uuid(),
      sale_id uuid not null references sales(id) on delete cascade,
      gym_id uuid references gyms(id) on delete cascade,
      product_id uuid references products(id) on delete set null,
      quantity integer not null default 1,
      unit_price numeric(10,2) not null default 0,
      subtotal numeric(10,2) not null default 0,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists inventory_movements (
      id uuid primary key default gen_random_uuid(),
      gym_id uuid references gyms(id) on delete cascade,
      product_id uuid references products(id) on delete cascade,
      movement_type text not null default 'ADJUSTMENT',
      quantity integer not null default 0,
      previous_stock integer not null default 0,
      new_stock integer not null default 0,
      reason text,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    alter table sale_items
    add column if not exists gym_id uuid references gyms(id) on delete cascade,
    add column if not exists product_id uuid references products(id) on delete set null,
    add column if not exists quantity integer not null default 1,
    add column if not exists unit_price numeric(10,2) not null default 0,
    add column if not exists subtotal numeric(10,2) not null default 0,
    add column if not exists created_at timestamptz not null default now()
  `;

  await sql`
    alter table inventory_movements
    add column if not exists gym_id uuid references gyms(id) on delete cascade,
    add column if not exists product_id uuid references products(id) on delete cascade,
    add column if not exists movement_type text,
    add column if not exists quantity integer not null default 0,
    add column if not exists previous_stock integer not null default 0,
    add column if not exists new_stock integer not null default 0,
    add column if not exists reason text,
    add column if not exists created_by uuid references users(id) on delete set null,
    add column if not exists created_at timestamptz not null default now()
  `;

  await sql`
    update inventory_movements
    set movement_type = 'ADJUSTMENT'
    where movement_type is null
  `;

  await sql`
    alter table inventory_movements
    alter column movement_type set default 'ADJUSTMENT',
    alter column movement_type set not null
  `;
}

type SalePayload = {
  productId: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  notes: string;
  saleDate: string;
};

function validateSalePayload(body: any) {
  const data: SalePayload = {
    productId: cleanString(body.productId),
    quantity: cleanInteger(body.quantity),
    paymentMethod: normalizePaymentMethod(body.paymentMethod),
    referenceCode: cleanString(body.referenceCode),
    notes: cleanString(body.notes),
    saleDate: cleanString(body.saleDate) || todayDateString(),
  };

  const errors: FieldErrors = {};

  if (!data.productId) {
    errors.productId = "Selecciona un producto";
  } else if (!isValidUuid(data.productId)) {
    errors.productId = "ID de producto inválido";
  }

  if (data.quantity <= 0) {
    errors.quantity = "La cantidad debe ser mayor a 0";
  }

  if (!Number.isInteger(data.quantity)) {
    errors.quantity = "La cantidad debe ser un número entero";
  }

  if (!["CASH", "CARD", "TRANSFER", "OTHER"].includes(data.paymentMethod)) {
    errors.paymentMethod = "Método de pago inválido";
  }

  if (!data.saleDate || !isValidDate(data.saleDate)) {
    errors.saleDate = "Fecha de venta inválida";
  }

  if (
    ["CARD", "TRANSFER"].includes(data.paymentMethod) &&
    !data.referenceCode
  ) {
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

function validateSaleId(value: string | null) {
  const saleId = cleanString(value);
  const errors: FieldErrors = {};

  if (!saleId) {
    errors.saleId = "Falta el ID de la venta";
  } else if (!isValidUuid(saleId)) {
    errors.saleId = "ID de venta inválido";
  }

  return {
    ok: Object.keys(errors).length === 0,
    saleId,
    errors,
  };
}

export async function GET() {
  try {
    const session = await getAuthorizedSalesSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const sales = await sql`
      select
        s.id,
        s.total,
        s.payment_method,
        s.reference_code,
        s.notes,
        to_char(s.sale_date, 'YYYY-MM-DD') as sale_date,
        s.status,
        s.created_at,
        u.full_name as created_by_name,
        si.product_id,
        si.quantity,
        si.unit_price,
        si.subtotal,
        p.name as product_name,
        p.image_url
      from sales s
      left join users u on u.id = s.created_by
      left join sale_items si on si.sale_id = s.id
      left join products p on p.id = si.product_id
      where s.gym_id = ${session.gymId}
      order by s.sale_date desc, s.created_at desc
    `;

    return NextResponse.json({
      ok: true,
      data: sales,
    });
  } catch (error) {
    console.error("Error obteniendo ventas:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo ventas: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let createdSaleId: string | null = null;
  let currentGymId: string | null = null;

  try {
    await prepareSalesDatabase();

    const session = await getAuthorizedSalesSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para registrar ventas" },
        { status: 403 }
      );
    }

    currentGymId = session.gymId;

    const body = await request.json();

    const validation = validateSalePayload(body);

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const {
      productId,
      quantity,
      paymentMethod,
      referenceCode,
      notes,
      saleDate,
    } = validation.data;

    const productResult = await sql`
      select
        id,
        name,
        price,
        stock,
        is_active
      from products
      where id = ${productId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (productResult.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Producto no encontrado",
          errors: {
            productId: "Producto no encontrado",
          },
        },
        { status: 404 }
      );
    }

    const product = productResult[0];

    if (!product.is_active) {
      return NextResponse.json(
        {
          ok: false,
          message: "El producto está inactivo",
          errors: {
            productId: "El producto está inactivo",
          },
        },
        { status: 400 }
      );
    }

    const currentStock = Number(product.stock || 0);
    const unitPrice = Number(product.price || 0);
    const total = unitPrice * quantity;

    if (unitPrice < 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "El producto tiene un precio inválido",
          errors: {
            productId: "El producto tiene un precio inválido",
          },
        },
        { status: 400 }
      );
    }

    if (currentStock <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Este producto no tiene stock disponible",
          errors: {
            quantity: "Este producto no tiene stock disponible",
          },
        },
        { status: 400 }
      );
    }

    if (quantity > currentStock) {
      return NextResponse.json(
        {
          ok: false,
          message: `Stock insuficiente. Disponible: ${currentStock}`,
          errors: {
            quantity: `Stock insuficiente. Disponible: ${currentStock}`,
          },
        },
        { status: 400 }
      );
    }

    const sale = await sql`
      insert into sales (
        gym_id,
        total,
        payment_method,
        reference_code,
        notes,
        sale_date,
        status,
        created_by,
        created_at,
        updated_at
      )
      values (
        ${session.gymId},
        ${total},
        ${paymentMethod},
        ${referenceCode || null},
        ${notes || null},
        ${saleDate},
        'COMPLETED',
        ${session.userId},
        now(),
        now()
      )
      returning
        id,
        gym_id,
        total,
        payment_method,
        reference_code,
        notes,
        to_char(sale_date, 'YYYY-MM-DD') as sale_date,
        status,
        created_at
    `;

    createdSaleId = sale[0].id;

    await sql`
      insert into sale_items (
        sale_id,
        gym_id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        created_at
      )
      values (
        ${createdSaleId},
        ${session.gymId},
        ${productId},
        ${quantity},
        ${unitPrice},
        ${total},
        now()
      )
    `;

    const newStock = currentStock - quantity;

    const updatedProduct = await sql`
      update products
      set
        stock = ${newStock},
        updated_at = now()
      where id = ${productId}
        and gym_id = ${session.gymId}
        and stock >= ${quantity}
      returning id, stock
    `;

    if (updatedProduct.length === 0) {
      throw new Error(
        "No se pudo actualizar el stock. Posiblemente el stock cambió mientras se registraba la venta."
      );
    }

    await sql`
      insert into inventory_movements (
        gym_id,
        product_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        created_by,
        created_at
      )
      values (
        ${session.gymId},
        ${productId},
        'OUT',
        ${quantity},
        ${currentStock},
        ${newStock},
        ${"Venta registrada: " + product.name},
        ${session.userId},
        now()
      )
    `;

    return NextResponse.json({
      ok: true,
      message: "Venta registrada correctamente",
      sale: sale[0],
    });
  } catch (error) {
    console.error("Error registrando venta:", error);

    if (createdSaleId && currentGymId) {
      try {
        await sql`
          delete from sales
          where id = ${createdSaleId}
            and gym_id = ${currentGymId}
        `;
      } catch (cleanupError) {
        console.error("Error limpiando venta incompleta:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Error registrando venta: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await prepareSalesDatabase();

    const session = await requireGymAdmin();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "Solo el administrador puede cancelar ventas" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const saleIdValidation = validateSaleId(url.searchParams.get("saleId"));

    if (!saleIdValidation.ok) {
      return validationResponse(saleIdValidation.errors);
    }

    const saleId = saleIdValidation.saleId;

    const sale = await sql`
      select
        id,
        status
      from sales
      where id = ${saleId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (sale.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Venta no encontrada" },
        { status: 404 }
      );
    }

    if (String(sale[0].status) === "CANCELLED") {
      return NextResponse.json(
        {
          ok: false,
          message: "Esta venta ya fue cancelada",
          errors: {
            saleId: "Esta venta ya fue cancelada",
          },
        },
        { status: 400 }
      );
    }

    const items = await sql`
      select
        si.product_id,
        si.quantity,
        p.name as product_name,
        p.stock as current_stock
      from sale_items si
      join products p on p.id = si.product_id
      where si.sale_id = ${saleId}
        and si.gym_id = ${session.gymId}
    `;

    for (const item of items) {
      const previousStock = Number(item.current_stock || 0);
      const quantity = Number(item.quantity || 0);
      const restoredStock = previousStock + quantity;

      await sql`
        update products
        set
          stock = ${restoredStock},
          updated_at = now()
        where id = ${item.product_id}
          and gym_id = ${session.gymId}
      `;

      await sql`
        insert into inventory_movements (
          gym_id,
          product_id,
          movement_type,
          quantity,
          previous_stock,
          new_stock,
          reason,
          created_by,
          created_at
        )
        values (
          ${session.gymId},
          ${item.product_id},
          'IN',
          ${quantity},
          ${previousStock},
          ${restoredStock},
          ${"Cancelación de venta: " + item.product_name},
          ${session.userId},
          now()
        )
      `;
    }

    await sql`
      update sales
      set
        status = 'CANCELLED',
        updated_at = now()
      where id = ${saleId}
        and gym_id = ${session.gymId}
    `;

    return NextResponse.json({
      ok: true,
      message: "Venta cancelada correctamente y stock restaurado",
    });
  } catch (error) {
    console.error("Error cancelando venta:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error cancelando venta: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}