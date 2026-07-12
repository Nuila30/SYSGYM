import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  cleanString,
  cleanNumber,
  cleanInteger,
  isValidUuid,
  isValidUrlOrPath,
  isValidDate,
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

async function getAuthorizedSession() {
  const session = await getCurrentSession();

  if (!session || !session.gymId) {
    return null;
  }

  if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
    return null;
  }

  return session;
}

type InventoryProductPayload = {
  productId: string;
  name: string;
  imageUrl: string;
  price: number;
  stock: number;
  stockEntryDate: string;
};

function validateInventoryProductPayload(body: any) {
  const data: InventoryProductPayload = {
    productId: cleanString(body.productId),
    name: cleanString(body.name),
    imageUrl: cleanString(body.imageUrl),
    price: cleanNumber(body.price),
    stock: cleanInteger(body.stock),
    stockEntryDate: cleanString(body.stockEntryDate),
  };

  const errors: FieldErrors = {};

  if (!data.productId) {
    errors.productId = "Falta el ID del producto";
  } else if (!isValidUuid(data.productId)) {
    errors.productId = "ID de producto inválido";
  }

  if (!data.name) {
    errors.name = "El nombre del producto es obligatorio";
  } else if (data.name.length < 2) {
    errors.name = "El nombre debe tener mínimo 2 caracteres";
  }

  if (data.imageUrl && !isValidUrlOrPath(data.imageUrl)) {
    errors.imageUrl =
      "La imagen debe ser una URL válida o una ruta como /images/producto.png";
  }

  if (data.price < 0) {
    errors.price = "El precio no puede ser negativo";
  }

  if (data.stock < 0) {
    errors.stock = "El stock no puede ser negativo";
  }

  if (data.stockEntryDate && !isValidDate(data.stockEntryDate)) {
    errors.stockEntryDate = "Fecha de ingreso inválida";
  }

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

export async function PATCH(request: Request) {
  try {
    const session = await getAuthorizedSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para editar inventario" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const validation = validateInventoryProductPayload(body);

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { productId, name, imageUrl, price, stock, stockEntryDate } =
      validation.data;

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
        {
          ok: false,
          message: "Ya existe otro producto con ese nombre",
          errors: {
            name: "Ya existe otro producto con ese nombre",
          },
        },
        { status: 409 }
      );
    }

    const previousStock = Number(productResult[0].stock || 0);
    const stockDifference = Math.abs(stock - previousStock);

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
        gym_id,
        name,
        image_url,
        price,
        stock,
        min_stock,
        to_char(stock_entry_date, 'YYYY-MM-DD') as stock_entry_date,
        is_active,
        created_at,
        updated_at
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
          created_by,
          created_at
        )
        values (
          ${session.gymId},
          ${productId},
          'ADJUSTMENT',
          ${stockDifference},
          ${previousStock},
          ${stock},
          'Actualización desde inventario',
          ${session.userId},
          now()
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
        message:
          "Error actualizando producto e inventario: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}