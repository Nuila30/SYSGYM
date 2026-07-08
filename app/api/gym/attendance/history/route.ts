import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session || !session.gymId) {
      return NextResponse.json(
        {
          ok: false,
          message: "No autenticado",
        },
        { status: 401 }
      );
    }

    const myAttendance = await sql`
      select
        id,
        to_char(attendance_date, 'YYYY-MM-DD') as attendance_date,
        to_char(check_in_at at time zone 'America/El_Salvador', 'HH24:MI') as check_in_time,
        to_char(check_out_at at time zone 'America/El_Salvador', 'HH24:MI') as check_out_time,
        status
      from attendance_logs
      where gym_id = ${session.gymId}
        and user_id = ${session.userId}
      order by attendance_date desc, created_at desc
      limit 30
    `;

    const gymAttendance =
      session.role === "GYM_ADMIN" || session.role === "EMPLOYEE"
        ? await sql`
            select
              al.id,
              to_char(al.attendance_date, 'YYYY-MM-DD') as attendance_date,
              to_char(al.check_in_at at time zone 'America/El_Salvador', 'HH24:MI') as check_in_time,
              to_char(al.check_out_at at time zone 'America/El_Salvador', 'HH24:MI') as check_out_time,
              al.status,
              u.full_name as user_name,
              u.username,
              u.role
            from attendance_logs al
            join users u on u.id = al.user_id
            where al.gym_id = ${session.gymId}
            order by al.attendance_date desc, al.created_at desc
            limit 100
          `
        : [];

    return NextResponse.json({
      ok: true,
      myAttendance,
      gymAttendance,
    });
  } catch (error) {
    console.error("Error cargando historial de asistencia:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error cargando historial: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}