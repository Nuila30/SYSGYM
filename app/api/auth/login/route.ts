import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import {
  generateTemporaryPassword,
  getTemporaryPasswordExpiration,
} from "@/lib/credentials";
import { sendCredentialsEmail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        {
          ok: false,
          message: "Usuario y contraseña son obligatorios",
        },
        { status: 400 }
      );
    }

    const users = await sql`
      select
        u.id,
        u.gym_id,
        u.full_name,
        u.username,
        u.email,
        u.password_hash,
        u.role,
        u.status,
        u.must_change_password,
        u.temp_password_expires_at,
        g.status as gym_status
      from users u
      left join gyms g on g.id = u.gym_id
      where lower(u.username) = ${username}
      limit 1
    `;

    if (users.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Usuario o contraseña incorrectos",
        },
        { status: 401 }
      );
    }

    const user = users[0];

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          ok: false,
          message: "Tu usuario está inactivo o suspendido",
        },
        { status: 403 }
      );
    }

    if (
      user.role !== "SUPER_ADMIN" &&
      user.gym_status &&
      user.gym_status !== "ACTIVE"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "El gimnasio está suspendido por falta de pago",
        },
        { status: 403 }
      );
    }

    if (
      user.must_change_password &&
      user.temp_password_expires_at &&
      new Date(user.temp_password_expires_at) < new Date()
    ) {
      const newTemporaryPassword = generateTemporaryPassword();
      const newExpiration = getTemporaryPasswordExpiration();
      const newHash = await bcrypt.hash(newTemporaryPassword, 10);

      await sql`
        update users
        set password_hash = ${newHash},
            temp_password_expires_at = ${newExpiration.toISOString()},
            credentials_email_sent_at = now()
        where id = ${user.id}
      `;

      await sendCredentialsEmail({
        to: user.email,
        fullName: user.full_name,
        username: user.username,
        temporaryPassword: newTemporaryPassword,
        expiresAt: newExpiration,
      });

      return NextResponse.json(
        {
          ok: false,
          code: "TEMP_PASSWORD_EXPIRED",
          message:
            "La contraseña temporal venció. Se generó una nueva y fue enviada al correo registrado.",
        },
        { status: 403 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Usuario o contraseña incorrectos",
        },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      gymId: user.gym_id,
      fullName: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    });

    const response = NextResponse.json({
      ok: true,
      message: "Login correcto",
      forceChangePassword: user.must_change_password,
      user: {
        id: user.id,
        gymId: user.gym_id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set("gym_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Error en login:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error interno en el login",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}