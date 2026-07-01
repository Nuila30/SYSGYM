import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import GymQrManager from "@/components/GymQrManager";
import AttendanceLivePanel from "@/components/AttendanceLivePanel";

export const dynamic = "force-dynamic";

type QrToken = {
  id: string;
  gym_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  user_name?: string | null;
  username?: string | null;
  role?: string | null;
};

async function getGym(gymId: string) {
  const gym = await sql`
    select
      id,
      name,
      status
    from gyms
    where id = ${gymId}
    limit 1
  `;

  return gym[0] || null;
}

async function getActiveQrToken(gymId: string) {
  const token = await sql`
    select
      id,
      gym_id,
      token,
      is_active,
      to_char(created_at at time zone 'America/El_Salvador', 'YYYY-MM-DD HH24:MI') as created_at
    from gym_qr_tokens
    where gym_id = ${gymId}
      and is_active = true
    order by created_at desc
    limit 1
  `;

  return (token[0] as QrToken) || null;
}

async function getMyAttendance(gymId: string, userId: string) {
  const records = await sql`
    select
      id,
      to_char(attendance_date, 'YYYY-MM-DD') as attendance_date,
      to_char(check_in_at at time zone 'America/El_Salvador', 'HH24:MI') as check_in_time,
      to_char(check_out_at at time zone 'America/El_Salvador', 'HH24:MI') as check_out_time,
      status
    from attendance_logs
    where gym_id = ${gymId}
      and user_id = ${userId}
    order by attendance_date desc, created_at desc
    limit 30
  `;

  return records as AttendanceRecord[];
}

async function getGymAttendance(gymId: string) {
  const records = await sql`
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
    where al.gym_id = ${gymId}
    order by al.attendance_date desc, al.created_at desc
    limit 100
  `;

  return records as AttendanceRecord[];
}

export default async function AttendancePage() {
  const session = await requireSession();

  if (!session.gymId) {
    redirect("/dashboard");
  }

  if (!["GYM_ADMIN", "EMPLOYEE", "MEMBER"].includes(session.role)) {
    redirect("/dashboard");
  }

  const gym = await getGym(session.gymId);

  if (!gym || gym.status !== "ACTIVE") {
    redirect("/dashboard");
  }

  const qrToken =
    session.role === "GYM_ADMIN" ? await getActiveQrToken(session.gymId) : null;

  const myAttendance = await getMyAttendance(session.gymId, session.userId);

  const gymAttendance =
    session.role === "GYM_ADMIN" || session.role === "EMPLOYEE"
      ? await getGymAttendance(session.gymId)
      : [];

  return (
    <main className="min-h-screen bg-neutral-100 lg:flex">
      <DashboardMenu
        fullName={session.fullName}
        username={session.username}
        role={session.role}
      />

      <section className="flex-1">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-7xl px-6 py-5">
            <h1 className="text-2xl font-bold text-neutral-900">
              Asistencia QR
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Marca entrada y salida escaneando el QR del gimnasio.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
          {session.role === "GYM_ADMIN" && (
            <GymQrManager initialToken={qrToken} gymName={gym.name} />
          )}

          <AttendanceLivePanel
            initialMyAttendance={myAttendance}
            initialGymAttendance={gymAttendance}
            canViewGymAttendance={
              session.role === "GYM_ADMIN" || session.role === "EMPLOYEE"
            }
          />
        </div>
      </section>
    </main>
  );
}