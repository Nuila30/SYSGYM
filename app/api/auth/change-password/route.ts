import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "Completa ambos campos" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { ok: false, message: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "Las contraseñas no coinciden" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await sql`
      update users
      set password_hash = ${passwordHash},
          must_change_password = false,
          temp_password_expires_at = null,
          password_changed_at = now(),
          updated_at = now()
      where id = ${session.userId}
    `;

    const response = NextResponse.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
    });

    response.cookies.set("gym_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Error cambiando contraseña:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error cambiando contraseña",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}