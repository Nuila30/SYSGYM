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

function normalizeMovementType(value: string) {
  const type = value.toUpperCase();

  if (["IN", "OUT", "ADJUSTMENT"].includes(type)) {
    return type;
  }

  return "IN";
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

    const movements = await sql`
      select
        im.id,
        im.product_id,
        im.movement_type,
        im.quantity,
        im.previous_stock,
        im.new_stock,
        im.reason,
        im.created_at,
        p.name as product_name,
        p.category,
        u.full_name as created_by_name
      from inventory_movements im
      join products p on p.id = im.product_id
      left join users u on u.id = im.created_by
      where im.gym_id = ${session.gymId}
      order by im.created_at desc
    `;

    return NextResponse.json({
      ok: true,
      data: movements,
    });
  } catch (error) {
    console.error("Error obteniendo inventario:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo inventario",
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
        { ok: false, message: "No autorizado para mover inventario" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const productId = cleanString(body.productId);
    const movementType = normalizeMovementType(cleanString(body.movementType));
    const quantity = cleanNumber(body.quantity);
    const reason = cleanString(body.reason);

    if (!productId) {
      return NextResponse.json(
        { ok: false, message: "Selecciona un producto" },
        { status: 400 }
      );
    }

    if (movementType !== "ADJUSTMENT" && quantity <= 0) {
      return NextResponse.json(
        { ok: false, message: "La cantidad debe ser mayor a 0" },
        { status: 400 }
      );
    }

    if (movementType === "ADJUSTMENT" && quantity < 0) {
      return NextResponse.json(
        { ok: false, message: "El nuevo stock no puede ser negativo" },
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

    const product = productResult[0];
    const previousStock = Number(product.stock || 0);

    let newStock = previousStock;

    if (movementType === "IN") {
      newStock = previousStock + quantity;
    }

    if (movementType === "OUT") {
      if (quantity > previousStock) {
        return NextResponse.json(
          {
            ok: false,
            message: "No hay suficiente stock para registrar esta salida",
          },
          { status: 400 }
        );
      }

      newStock = previousStock - quantity;
    }

    if (movementType === "ADJUSTMENT") {
      newStock = quantity;
    }

    await sql`
      update products
      set
        stock = ${newStock},
        updated_at = now()
      where id = ${productId}
        and gym_id = ${session.gymId}
    `;

    const movement = await sql`
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
        ${movementType},
        ${quantity},
        ${previousStock},
        ${newStock},
        ${reason || null},
        ${session.userId}
      )
      returning
        id,
        product_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        created_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Movimiento de inventario registrado correctamente",
      movement: movement[0],
    });
  } catch (error) {
    console.error("Error registrando movimiento de inventario:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error registrando movimiento de inventario",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}