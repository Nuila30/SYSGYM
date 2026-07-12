import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import {
  generateTemporaryPassword,
  generateUniqueUsername,
  getTemporaryPasswordExpiration,
} from "@/lib/credentials";
import { sendCredentialsEmail } from "@/lib/mail";
import {
  cleanString,
  cleanEmail,
  isValidUuid,
  validateGymUserPayload,
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

function normalizeRole(value: unknown) {
  return cleanString(value).toUpperCase();
}

function normalizeStatus(value: unknown) {
  return cleanString(value || "ACTIVE").toUpperCase();
}

function validateUserId(value: string | null) {
  const userId = cleanString(value);
  const errors: FieldErrors = {};

  if (!userId) {
    errors.userId = "Falta el ID del usuario";
  } else if (!isValidUuid(userId)) {
    errors.userId = "ID de usuario inválido";
  }

  return {
    ok: Object.keys(errors).length === 0,
    userId,
    errors,
  };
}

function validateUserBody(body: any, mode: "create" | "edit") {
  const validation = validateGymUserPayload(body);
  const errors: FieldErrors = {
    ...validation.errors,
  };

  const rawRole = normalizeRole(body.role);
  const rawStatus = normalizeStatus(body.status);

  if (!["EMPLOYEE", "MEMBER", "GYM_ADMIN"].includes(rawRole)) {
    errors.role = "Rol inválido";
  }

  if (mode === "edit" && !["ACTIVE", "INACTIVE"].includes(rawStatus)) {
    errors.status = "Estado inválido";
  }

  if (!validation.data) {
    return {
      ok: false,
      data: null,
      errors,
    };
  }

  return {
    ok: Object.keys(errors).length === 0,
    data: {
      ...validation.data,
      role: rawRole as "GYM_ADMIN" | "EMPLOYEE" | "MEMBER",
      status: rawStatus as "ACTIVE" | "INACTIVE",
    },
    errors,
  };
}

function canManageTargetRole(currentRole: string, targetRole: string) {
  if (currentRole === "GYM_ADMIN") {
    return ["EMPLOYEE", "MEMBER"].includes(targetRole);
  }

  if (currentRole === "EMPLOYEE") {
    return targetRole === "MEMBER";
  }

  return false;
}

async function getAuthorizedGymSession() {
  const session = await getCurrentSession();

  if (!session || !session.gymId) {
    return null;
  }

  if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
    return null;
  }

  return session;
}

export async function GET() {
  try {
    const session = await getAuthorizedGymSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const users =
      session.role === "GYM_ADMIN"
        ? await sql`
            select
              id,
              gym_id,
              full_name,
              username,
              email,
              phone,
              role::text as role,
              status::text as status,
              must_change_password,
              temp_password_expires_at,
              credentials_email_sent_at,
              created_at,
              updated_at
            from users
            where gym_id = ${session.gymId}
            order by
              case role
                when 'GYM_ADMIN' then 1
                when 'EMPLOYEE' then 2
                when 'MEMBER' then 3
                else 4
              end,
              created_at desc
          `
        : await sql`
            select
              id,
              gym_id,
              full_name,
              username,
              email,
              phone,
              role::text as role,
              status::text as status,
              must_change_password,
              temp_password_expires_at,
              credentials_email_sent_at,
              created_at,
              updated_at
            from users
            where gym_id = ${session.gymId}
              and role = 'MEMBER'
            order by created_at desc
          `;

    return NextResponse.json({
      ok: true,
      data: users,
    });
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo usuarios: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const session = await getAuthorizedGymSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para crear usuarios" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const validation = validateUserBody(body, "create");

    if (!validation.ok || !validation.data) {
      return validationResponse(validation.errors);
    }

    const { fullName, email, phone, role } = validation.data;

    if (!canManageTargetRole(session.role, role)) {
      return NextResponse.json(
        {
          ok: false,
          message: "No tienes permiso para crear ese tipo de usuario",
          errors: {
            role: "No tienes permiso para crear ese tipo de usuario",
          },
        },
        { status: 403 }
      );
    }

    const duplicateEmail = await sql`
      select id
      from users
      where lower(email) = ${email}
      limit 1
    `;

    if (duplicateEmail.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya existe un usuario con ese correo",
          errors: {
            email: "Ya existe un usuario con ese correo",
          },
        },
        { status: 409 }
      );
    }

    const username = await generateUniqueUsername(fullName, phone);
    const temporaryPassword = generateTemporaryPassword(fullName, phone);
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const expiresAt = getTemporaryPasswordExpiration();

    const createdUser = await sql`
      insert into users (
        gym_id,
        full_name,
        username,
        email,
        phone,
        role,
        status,
        password_hash,
        must_change_password,
        temp_password_expires_at,
        credentials_email_sent_at,
        created_at,
        updated_at
      )
      values (
        ${session.gymId},
        ${fullName},
        ${username},
        ${email},
        ${phone},
        ${role},
        'ACTIVE',
        ${passwordHash},
        true,
        ${expiresAt},
        null,
        now(),
        now()
      )
      returning id
    `;

    createdUserId = createdUser[0].id;

    try {
      await sendCredentialsEmail({
        to: email,
        fullName,
        username,
        temporaryPassword,
        expiresAt,
      });

      await sql`
        update users
        set
          credentials_email_sent_at = now(),
          updated_at = now()
        where id = ${createdUserId}
      `;
    } catch (error) {
      console.error("No se pudo enviar correo al usuario:", error);

      await sql`
        delete from users
        where id = ${createdUserId}
      `;

      return NextResponse.json(
        {
          ok: false,
          message:
            "No se pudo enviar el correo de credenciales. No se creó el usuario.",
          error: getErrorMessage(error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Usuario creado y credenciales enviadas correctamente",
    });
  } catch (error) {
    console.error("Error creando usuario:", error);

    if (createdUserId) {
      try {
        await sql`
          delete from users
          where id = ${createdUserId}
        `;
      } catch (cleanupError) {
        console.error("Error limpiando usuario incompleto:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Error creando usuario: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAuthorizedGymSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para editar usuarios" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const userIdValidation = validateUserId(url.searchParams.get("userId"));

    if (!userIdValidation.ok) {
      return validationResponse(userIdValidation.errors);
    }

    const userId = userIdValidation.userId;

    const body = await request.json();

    const validation = validateUserBody(body, "edit");

    if (!validation.ok || !validation.data) {
      return validationResponse(validation.errors);
    }

    const { fullName, email, phone, role, status } = validation.data;

    const targetUser = await sql`
      select id, role::text as role, gym_id
      from users
      where id = ${userId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (targetUser.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (!canManageTargetRole(session.role, String(targetUser[0].role))) {
      return NextResponse.json(
        { ok: false, message: "No tienes permiso para editar este usuario" },
        { status: 403 }
      );
    }

    if (!canManageTargetRole(session.role, role)) {
      return NextResponse.json(
        {
          ok: false,
          message: "No puedes asignar ese rol",
          errors: {
            role: "No puedes asignar ese rol",
          },
        },
        { status: 403 }
      );
    }

    const duplicateEmail = await sql`
      select id
      from users
      where lower(email) = ${email}
        and id <> ${userId}
      limit 1
    `;

    if (duplicateEmail.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ese correo ya está en uso",
          errors: {
            email: "Ese correo ya está en uso",
          },
        },
        { status: 409 }
      );
    }

    const updatedUser = await sql`
      update users
      set
        full_name = ${fullName},
        email = ${email},
        phone = ${phone},
        role = ${role},
        status = ${status},
        updated_at = now()
      where id = ${userId}
        and gym_id = ${session.gymId}
      returning
        id,
        full_name,
        username,
        email,
        phone,
        role::text as role,
        status::text as status,
        updated_at
    `;

    return NextResponse.json({
      ok: true,
      message: "Usuario actualizado correctamente",
      user: updatedUser[0],
    });
  } catch (error) {
    console.error("Error editando usuario:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error editando usuario: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getAuthorizedGymSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para regenerar contraseña" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const userIdValidation = validateUserId(url.searchParams.get("userId"));

    if (!userIdValidation.ok) {
      return validationResponse(userIdValidation.errors);
    }

    const userId = userIdValidation.userId;

    const targetUser = await sql`
      select
        id,
        full_name,
        username,
        email,
        phone,
        role::text as role,
        password_hash,
        must_change_password,
        temp_password_expires_at,
        credentials_email_sent_at
      from users
      where id = ${userId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (targetUser.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = targetUser[0];

    if (!canManageTargetRole(session.role, String(user.role))) {
      return NextResponse.json(
        { ok: false, message: "No tienes permiso para regenerar esta contraseña" },
        { status: 403 }
      );
    }

    const email = cleanEmail(user.email);

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          message: "El usuario no tiene correo registrado",
          errors: {
            email: "El usuario no tiene correo registrado",
          },
        },
        { status: 400 }
      );
    }

    const temporaryPassword = generateTemporaryPassword(
      user.full_name,
      user.phone
    );

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const expiresAt = getTemporaryPasswordExpiration();

    const oldPasswordHash = user.password_hash;
    const oldMustChangePassword = user.must_change_password;
    const oldTempPasswordExpiresAt = user.temp_password_expires_at;
    const oldCredentialsEmailSentAt = user.credentials_email_sent_at;

    await sql`
      update users
      set
        password_hash = ${passwordHash},
        must_change_password = true,
        temp_password_expires_at = ${expiresAt},
        credentials_email_sent_at = null,
        updated_at = now()
      where id = ${user.id}
    `;

    try {
      await sendCredentialsEmail({
        to: email,
        fullName: user.full_name,
        username: user.username,
        temporaryPassword,
        expiresAt,
      });

      await sql`
        update users
        set
          credentials_email_sent_at = now(),
          updated_at = now()
        where id = ${user.id}
      `;
    } catch (error) {
      console.error("No se pudo enviar nueva contraseña:", error);

      await sql`
        update users
        set
          password_hash = ${oldPasswordHash},
          must_change_password = ${oldMustChangePassword},
          temp_password_expires_at = ${oldTempPasswordExpiresAt},
          credentials_email_sent_at = ${oldCredentialsEmailSentAt},
          updated_at = now()
        where id = ${user.id}
      `;

      return NextResponse.json(
        {
          ok: false,
          message:
            "No se pudo enviar el correo. La contraseña anterior se mantiene.",
          error: getErrorMessage(error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Nueva contraseña temporal enviada correctamente. Se reenviará cada 8 horas hasta que el usuario la cambie.",
    });
  } catch (error) {
    console.error("Error regenerando contraseña:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error regenerando contraseña: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getAuthorizedGymSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para desactivar usuarios" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const userIdValidation = validateUserId(url.searchParams.get("userId"));

    if (!userIdValidation.ok) {
      return validationResponse(userIdValidation.errors);
    }

    const userId = userIdValidation.userId;

    const targetUser = await sql`
      select id, role::text as role
      from users
      where id = ${userId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (targetUser.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (!canManageTargetRole(session.role, String(targetUser[0].role))) {
      return NextResponse.json(
        { ok: false, message: "No tienes permiso para desactivar este usuario" },
        { status: 403 }
      );
    }

    await sql`
      update users
      set
        status = 'INACTIVE',
        updated_at = now()
      where id = ${userId}
        and gym_id = ${session.gymId}
    `;

    return NextResponse.json({
      ok: true,
      message: "Usuario desactivado correctamente",
    });
  } catch (error) {
    console.error("Error desactivando usuario:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error desactivando usuario: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}