import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import CreateGymUserForm from "@/components/CreateGymUserForm";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  must_change_password: boolean | null;
  temp_password_expires_at: string | null;
  credentials_email_sent_at: string | null;
};

async function getUsers(gymId: string, role: string) {
  if (role === "EMPLOYEE") {
    const users = await sql`
      select
        id,
        full_name,
        username,
        email,
        phone,
        role::text as role,
        status::text as status,
        must_change_password,
        temp_password_expires_at,
        credentials_email_sent_at
      from users
      where gym_id = ${gymId}
        and role = 'MEMBER'
      order by created_at desc
    `;

    return users as UserRow[];
  }

  const users = await sql`
    select
      id,
      full_name,
      username,
      email,
      phone,
      role::text as role,
      status::text as status,
      must_change_password,
      temp_password_expires_at,
      credentials_email_sent_at
    from users
    where gym_id = ${gymId}
    order by
      case role
        when 'GYM_ADMIN' then 1
        when 'EMPLOYEE' then 2
        when 'MEMBER' then 3
        else 4
      end,
      created_at desc
  `;

  return users as UserRow[];
}

export default async function UsersPage() {
  const session = await requireSession();

  if (!session.gymId) {
    redirect("/dashboard");
  }

  if (!["GYM_ADMIN", "EMPLOYEE"].includes(session.role)) {
    redirect("/dashboard");
  }

  const gym = await sql`
    select id, name, status
    from gyms
    where id = ${session.gymId}
    limit 1
  `;

  if (gym.length === 0) {
    redirect("/dashboard");
  }

  const users = await getUsers(session.gymId, session.role);

  return (
    <main className="min-h-screen bg-neutral-100 lg:flex">
      <DashboardMenu
        fullName={session.fullName}
        username={session.username}
        role={session.role}
      />

      <section className="flex-1">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Usuarios del gimnasio
              </h1>

              <p className="mt-1 text-sm text-neutral-500">
                Registra empleados y miembros. Gimnasio: {gym[0].name}
              </p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Volver
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <CreateGymUserForm
            users={users}
            currentUserRole={session.role}
          />
        </div>
      </section>
    </main>
  );
}