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

function extractToken(value: string) {
  const cleanValue = value.trim();

  try {
    const url = new URL(cleanValue);
    return url.searchParams.get("token") || "";
  } catch {
    return cleanValue;
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

    if (!["GYM_ADMIN", "EMPLOYEE", "MEMBER"].includes(session.role)) {
      return NextResponse.json(
        { ok: false, message: "No autorizado para marcar asistencia" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const scannedValue = cleanString(body.token);
    const token = extractToken(scannedValue);

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "QR no válido" },
        { status: 400 }
      );
    }

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
        },
        { status: 403 }
      );
    }

    const userResult = await sql`
      select
        id,
        full_name,
        role,
        status
      from users
      where id = ${session.userId}
        and gym_id = ${session.gymId}
      limit 1
    `;

    if (userResult.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Usuario no encontrado en este gimnasio" },
        { status: 404 }
      );
    }

    if (userResult[0].status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, message: "Tu usuario no está activo" },
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
        status
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
          status
        )
        values (
          ${session.gymId},
          ${session.userId},
          ${today},
          now(),
          ${token},
          'OPEN'
        )
        returning
          id,
          attendance_date,
          check_in_at,
          check_out_at,
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
        returning
          id,
          attendance_date,
          check_in_at,
          check_out_at,
          status
      `;

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
        attendance,
      },
      { status: 409 }
    );
  } catch (error) {
    console.error("Error marcando asistencia:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error marcando asistencia",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}