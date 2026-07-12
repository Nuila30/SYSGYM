import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  cleanString,
  validatePassword,
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

type ChangePasswordPayload = {
  newPassword: string;
  confirmPassword: string;
};

function validateChangePasswordBody(body: any) {
  const data: ChangePasswordPayload = {
    newPassword: cleanString(body.newPassword),
    confirmPassword: cleanString(body.confirmPassword),
  };

  const errors: FieldErrors = {};

  if (!data.newPassword) {
    errors.newPassword = "La nueva contraseña es obligatoria";
  } else {
    const passwordError = validatePassword(data.newPassword);

    if (passwordError) {
      errors.newPassword = passwordError;
    }
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = "Confirma la nueva contraseña";
  }

  if (
    data.newPassword &&
    data.confirmPassword &&
    data.newPassword !== data.confirmPassword
  ) {
    errors.confirmPassword = "Las contraseñas no coinciden";
  }

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

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

    const validation = validateChangePasswordBody(body);

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { newPassword } = validation.data;

    const userResult = await sql`
      select
        id,
        password_hash,
        status::text as status,
        must_change_password,
        temp_password_expires_at
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

    if (String(user.status) !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, message: "Tu usuario está inactivo o suspendido" },
        { status: 403 }
      );
    }

    if (
      user.must_change_password &&
      user.temp_password_expires_at &&
      new Date(user.temp_password_expires_at) < new Date()
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La contraseña temporal venció. Inicia sesión nuevamente para recibir una nueva contraseña temporal.",
          code: "TEMP_PASSWORD_EXPIRED",
        },
        { status: 403 }
      );
    }

    const sameAsOldPassword = await bcrypt.compare(
      newPassword,
      user.password_hash
    );

    if (sameAsOldPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "La nueva contraseña debe ser diferente a la anterior",
          errors: {
            newPassword: "La nueva contraseña debe ser diferente a la anterior",
          },
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const updatedUser = await sql`
      update users
      set
        password_hash = ${passwordHash},
        must_change_password = false,
        temp_password_expires_at = null,
        password_changed_at = now(),
        updated_at = now()
      where id = ${session.userId}
      returning id
    `;

    if (updatedUser.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No se pudo actualizar la contraseña" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      message: "Contraseña actualizada correctamente. Inicia sesión nuevamente.",
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
        message: "Error cambiando contraseña: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}