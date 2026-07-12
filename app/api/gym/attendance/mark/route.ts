import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { cleanString, type FieldErrors } from "@/lib/validacion";

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

function extractToken(value: unknown) {
  const cleanValue = cleanString(value);

  if (!cleanValue) return "";

  try {
    const url = new URL(cleanValue);
    return cleanString(url.searchParams.get("token"));
  } catch {
    const match = cleanValue.match(/[?&]token=([^&]+)/);

    if (match?.[1]) {
      return cleanString(decodeURIComponent(match[1]));
    }

    return cleanValue;
  }
}

function validateQrPayload(body: any) {
  const token = extractToken(body.token);

  const errors: FieldErrors = {};

  if (!token) {
    errors.token = "QR no válido";
  } else if (token.length < 20) {
    errors.token = "El token del QR parece incompleto";
  } else if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    errors.token = "El token del QR contiene caracteres inválidos";
  }

  return {
    ok: Object.keys(errors).length === 0,
    data: {
      token,
    },
    errors,
  };
}

async function getAuthorizedSession() {
  const session = await getCurrentSession();

  if (!session || !session.gymId) {
    return null;
  }

  if (!["GYM_ADMIN", "EMPLOYEE", "MEMBER"].includes(session.role)) {
    return null;
  }

  return session;
}

export async function POST(request: Request) {
  try {
    const session = await getAuthorizedSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para marcar asistencia" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const validation = validateQrPayload(body);

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { token } = validation.data;

    const qrToken = await sql`
      select
        id,
        gym_id,
        token,
        is_active
      from gym_qr_tokens
      where token = ${token}
        and gym_id = ${session.gymId}
        and is_active = true
      limit 1
    `;

    if (qrToken.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Este QR no pertenece a tu gimnasio o ya no está activo",
          errors: {
            token: "Este QR no pertenece a tu gimnasio o ya no está activo",
          },
        },
        { status: 403 }
      );
    }

    const userResult = await sql`
      select
        id,
        full_name,
        role::text as role,
        status::text as status
      from users
      where id = ${session.userId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (userResult.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Usuario no encontrado en este gimnasio",
        },
        { status: 404 }
      );
    }

    const user = userResult[0];

    if (String(user.status) !== "ACTIVE") {
      return NextResponse.json(
        {
          ok: false,
          message: "Tu usuario no está activo",
        },
        { status: 403 }
      );
    }

    const svDate = await sql`
      select
        (now() at time zone 'America/El_Salvador')::date as today
    `;

    const today = svDate[0].today;

    const existingAttendance = await sql`
      select
        id,
        attendance_date,
        check_in_at,
        check_out_at,
        status::text as status
      from attendance_logs
      where gym_id = ${session.gymId}
        and user_id = ${session.userId}
        and attendance_date = ${today}
      limit 1
    `;

    if (existingAttendance.length === 0) {
      const attendance = await sql`
        insert into attendance_logs (
          gym_id,
          user_id,
          attendance_date,
          check_in_at,
          qr_token,
          status,
          created_at,
          updated_at
        )
        values (
          ${session.gymId},
          ${session.userId},
          ${today},
          now(),
          ${token},
          'OPEN',
          now(),
          now()
        )
        returning
          id,
          to_char(attendance_date, 'YYYY-MM-DD') as attendance_date,
          to_char(check_in_at at time zone 'America/El_Salvador', 'HH24:MI') as check_in_time,
          to_char(check_out_at at time zone 'America/El_Salvador', 'HH24:MI') as check_out_time,
          status
      `;

      return NextResponse.json({
        ok: true,
        action: "CHECK_IN",
        message: "Entrada registrada correctamente",
        attendance: attendance[0],
      });
    }

    const attendance = existingAttendance[0];

    if (!attendance.check_out_at) {
      const updatedAttendance = await sql`
        update attendance_logs
        set
          check_out_at = now(),
          status = 'CLOSED',
          updated_at = now()
        where id = ${attendance.id}
          and gym_id = ${session.gymId}
          and user_id = ${session.userId}
          and check_out_at is null
        returning
          id,
          to_char(attendance_date, 'YYYY-MM-DD') as attendance_date,
          to_char(check_in_at at time zone 'America/El_Salvador', 'HH24:MI') as check_in_time,
          to_char(check_out_at at time zone 'America/El_Salvador', 'HH24:MI') as check_out_time,
          status
      `;

      if (updatedAttendance.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            action: "COMPLETED",
            message: "La salida ya fue registrada",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        ok: true,
        action: "CHECK_OUT",
        message: "Salida registrada correctamente",
        attendance: updatedAttendance[0],
      });
    }

    return NextResponse.json(
      {
        ok: false,
        action: "COMPLETED",
        message: "Ya registraste entrada y salida para la fecha de hoy",
        attendance: {
          id: attendance.id,
          attendance_date: attendance.attendance_date,
          status: attendance.status,
        },
      },
      { status: 409 }
    );
  } catch (error) {
    console.error("Error marcando asistencia:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error marcando asistencia: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}