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
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : 0;
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

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para editar inventario" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const productId = cleanString(body.productId);
    const name = cleanString(body.name);
    const imageUrl = cleanString(body.imageUrl);
    const price = cleanNumber(body.price);
    const stock = cleanInteger(body.stock);
    const stockEntryDate = cleanString(body.stockEntryDate);

    if (!productId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del producto" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { ok: false, message: "El nombre del producto es obligatorio" },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { ok: false, message: "El precio no puede ser negativo" },
        { status: 400 }
      );
    }

    if (stock < 0) {
      return NextResponse.json(
        { ok: false, message: "El stock no puede ser negativo" },
        { status: 400 }
      );
    }

    const productResult = await sql`
      select
        id,
        name,
        stock
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

    const duplicate = await sql`
      select id
      from products
      where gym_id = ${session.gymId}
        and lower(name) = ${name.toLowerCase()}
        and id <> ${productId}
      limit 1
    `;

    if (duplicate.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ya existe otro producto con ese nombre" },
        { status: 409 }
      );
    }

    const previousStock = Number(productResult[0].stock || 0);

    const product = await sql`
      update products
      set
        name = ${name},
        image_url = ${imageUrl || null},
        price = ${price},
        stock = ${stock},
        stock_entry_date = ${stockEntryDate || null},
        updated_at = now()
      where id = ${productId}
        and gym_id = ${session.gymId}
      returning
        id,
        name,
        image_url,
        price,
        stock,
        stock_entry_date,
        is_active
    `;

    if (previousStock !== stock) {
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
          'ADJUSTMENT',
          ${stock},
          ${previousStock},
          ${stock},
          'Actualización desde inventario',
          ${session.userId}
        )
      `;
    }

    return NextResponse.json({
      ok: true,
      message: "Producto e inventario actualizados correctamente",
      product: product[0],
    });
  } catch (error) {
    console.error("Error actualizando producto e inventario:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error actualizando producto e inventario",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}