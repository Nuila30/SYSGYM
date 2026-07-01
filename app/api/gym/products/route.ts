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

    if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const products = await sql`
      select
        id,
        gym_id,
        name,
        image_url,
        price,
        stock,
        stock_entry_date,
        is_active,
        created_at,
        updated_at
      from products
      where gym_id = ${session.gymId}
      order by name asc
    `;

    return NextResponse.json({
      ok: true,
      data: products,
    });
  } catch (error) {
    console.error("Error obteniendo productos:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo productos",
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
          message: "Solo el administrador puede crear productos",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = cleanString(body.name);
    const imageUrl = cleanString(body.imageUrl);
    const price = cleanNumber(body.price);

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

    const duplicate = await sql`
      select id
      from products
      where gym_id = ${session.gymId}
        and lower(name) = ${name.toLowerCase()}
      limit 1
    `;

    if (duplicate.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ya existe un producto con ese nombre" },
        { status: 409 }
      );
    }

    const product = await sql`
      insert into products (
        gym_id,
        name,
        image_url,
        price,
        stock,
        min_stock,
        stock_entry_date,
        is_active
      )
      values (
        ${session.gymId},
        ${name},
        ${imageUrl || null},
        ${price},
        0,
        0,
        null,
        true
      )
      returning
        id,
        gym_id,
        name,
        image_url,
        price,
        stock,
        stock_entry_date,
        is_active,
        created_at,
        updated_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Producto creado correctamente",
      product: product[0],
    });
  } catch (error) {
    console.error("Error creando producto:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error creando producto",
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
          message: "Solo el administrador puede editar productos",
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del producto" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const name = cleanString(body.name);
    const imageUrl = cleanString(body.imageUrl);
    const price = cleanNumber(body.price);
    const isActive = Boolean(body.isActive);

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

    const productExists = await sql`
      select id
      from products
      where id = ${productId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (productExists.length === 0) {
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

    const product = await sql`
      update products
      set
        name = ${name},
        image_url = ${imageUrl || null},
        price = ${price},
        is_active = ${isActive},
        updated_at = now()
      where id = ${productId}
        and gym_id = ${session.gymId}
      returning
        id,
        gym_id,
        name,
        image_url,
        price,
        stock,
        stock_entry_date,
        is_active,
        created_at,
        updated_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Producto actualizado correctamente",
      product: product[0],
    });
  } catch (error) {
    console.error("Error editando producto:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error editando producto",
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
          message: "Solo el administrador puede eliminar productos",
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del producto" },
        { status: 400 }
      );
    }

    const product = await sql`
      select id
      from products
      where id = ${productId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (product.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Producto no encontrado" },
        { status: 404 }
      );
    }

    await sql`
      delete from products
      where id = ${productId}
        and gym_id = ${session.gymId}
    `;

    return NextResponse.json({
      ok: true,
      message: "Producto eliminado correctamente",
    });
  } catch (error) {
    console.error("Error eliminando producto:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error eliminando producto",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}