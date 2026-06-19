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

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const fullName = cleanString(body.fullName);
    const email = cleanString(body.email).toLowerCase();
    const phone = cleanString(body.phone);

    if (!fullName) {
      return NextResponse.json(
        { ok: false, message: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, message: "El correo es obligatorio" },
        { status: 400 }
      );
    }

    const emailExists = await sql`
      select id
      from users
      where lower(email) = ${email}
        and id <> ${session.userId}
      limit 1
    `;

    if (emailExists.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Ya existe otro usuario con ese correo" },
        { status: 409 }
      );
    }

    const updatedUser = await sql`
      update users
      set
        full_name = ${fullName},
        email = ${email},
        phone = ${phone || null},
        updated_at = now()
      where id = ${session.userId}
      returning
        id,
        full_name,
        username,
        email,
        phone,
        role,
        status
    `;

    if (updatedUser.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Perfil actualizado correctamente",
      user: updatedUser[0],
    });
  } catch (error) {
    console.error("Error actualizando perfil:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error actualizando perfil",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}