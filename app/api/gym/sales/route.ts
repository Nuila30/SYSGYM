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

    const sales = await sql`
      select
        s.id,
        s.total,
        s.payment_method,
        s.reference_code,
        s.notes,
        s.sale_date,
        s.status,
        s.created_at,
        u.full_name as created_by_name,
        si.product_id,
        si.quantity,
        si.unit_price,
        si.subtotal,
        p.name as product_name,
        p.category
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
        message: "Error obteniendo ventas",
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
        { ok: false, message: "No autorizado para registrar ventas" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const productId = cleanString(body.productId);
    const quantity = Math.trunc(cleanNumber(body.quantity));
    const paymentMethod = normalizePaymentMethod(
      cleanString(body.paymentMethod)
    );
    const referenceCode = cleanString(body.referenceCode);
    const notes = cleanString(body.notes);
    const saleDate =
      cleanString(body.saleDate) || new Date().toISOString().slice(0, 10);

    if (!productId) {
      return NextResponse.json(
        { ok: false, message: "Selecciona un producto" },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { ok: false, message: "La cantidad debe ser mayor a 0" },
        { status: 400 }
      );
    }

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
        { ok: false, message: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const product = productResult[0];

    if (!product.is_active) {
      return NextResponse.json(
        { ok: false, message: "El producto está inactivo" },
        { status: 400 }
      );
    }

    const currentStock = Number(product.stock || 0);
    const unitPrice = Number(product.price || 0);
    const total = unitPrice * quantity;

    if (quantity > currentStock) {
      return NextResponse.json(
        {
          ok: false,
          message: `Stock insuficiente. Disponible: ${currentStock}`,
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
        created_by
      )
      values (
        ${session.gymId},
        ${total},
        ${paymentMethod},
        ${referenceCode || null},
        ${notes || null},
        ${saleDate},
        'COMPLETED',
        ${session.userId}
      )
      returning
        id,
        gym_id,
        total,
        payment_method,
        reference_code,
        notes,
        sale_date,
        status,
        created_at
    `;

    await sql`
      insert into sale_items (
        sale_id,
        gym_id,
        product_id,
        quantity,
        unit_price,
        subtotal
      )
      values (
        ${sale[0].id},
        ${session.gymId},
        ${productId},
        ${quantity},
        ${unitPrice},
        ${total}
      )
    `;

    const newStock = currentStock - quantity;

    await sql`
      update products
      set
        stock = ${newStock},
        updated_at = now()
      where id = ${productId}
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
        created_by
      )
      values (
        ${session.gymId},
        ${productId},
        'OUT',
        ${quantity},
        ${currentStock},
        ${newStock},
        ${"Venta registrada: " + product.name},
        ${session.userId}
      )
    `;

    return NextResponse.json({
      ok: true,
      message: "Venta registrada correctamente",
      sale: sale[0],
    });
  } catch (error) {
    console.error("Error creando venta:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error registrando venta",
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
        { ok: false, message: "Solo el administrador puede cancelar ventas" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const saleId = url.searchParams.get("saleId");

    if (!saleId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID de la venta" },
        { status: 400 }
      );
    }

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

    if (sale[0].status === "CANCELLED") {
      return NextResponse.json(
        { ok: false, message: "Esta venta ya fue cancelada" },
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
      const restoredStock = previousStock + Number(item.quantity || 0);

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
          created_by
        )
        values (
          ${session.gymId},
          ${item.product_id},
          'IN',
          ${item.quantity},
          ${previousStock},
          ${restoredStock},
          ${"Cancelación de venta: " + item.product_name},
          ${session.userId}
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
        message: "Error cancelando venta",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}