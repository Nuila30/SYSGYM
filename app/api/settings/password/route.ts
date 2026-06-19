import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function cleanString(value: unknown) {
  return String(value || "");
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

    const currentPassword = cleanString(body.currentPassword);
    const newPassword = cleanString(body.newPassword);
    const confirmPassword = cleanString(body.confirmPassword);

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "Completa todos los campos" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          message: "La nueva contraseña debe tener al menos 8 caracteres",
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "Las contraseñas no coinciden" },
        { status: 400 }
      );
    }

    const userResult = await sql`
      select id, password_hash
      from users
      where id = ${session.userId}
      limit 1
    `;

    if (userResult.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = userResult[0];

    const validPassword = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!validPassword) {
      return NextResponse.json(
        { ok: false, message: "La contraseña actual no es correcta" },
        { status: 400 }
      );
    }

    const samePassword = await bcrypt.compare(newPassword, user.password_hash);

    if (samePassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "La nueva contraseña debe ser diferente a la actual",
        },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await sql`
      update users
      set
        password_hash = ${newHash},
        must_change_password = false,
        temp_password_expires_at = null,
        password_changed_at = now(),
        updated_at = now()
      where id = ${session.userId}
    `;

    return NextResponse.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("Error cambiando contraseña:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error cambiando contraseña",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}