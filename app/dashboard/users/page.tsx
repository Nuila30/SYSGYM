import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import CreateGymUserForm from "@/components/CreateGymUserForm";
import DashboardMenu from "@/components/DashboardMenu";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  created_at: string;
};

async function getUsers(gymId: string, currentRole: string) {
  if (currentRole === "EMPLOYEE") {
    const users = await sql`
      select
        id,
        full_name,
        username,
        email,
        phone,
        role,
        status,
        created_at
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
      role,
      status,
      created_at
    from users
    where gym_id = ${gymId}
      and role in ('GYM_ADMIN', 'EMPLOYEE', 'MEMBER')
    order by created_at desc
  `;

  return users as UserRow[];
}

export default async function GymUsersPage() {
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

  if (gym.length === 0 || gym[0].status !== "ACTIVE") {
    redirect("/dashboard");
  }

  const users = await getUsers(session.gymId, session.role);

  const pageTitle =
    session.role === "EMPLOYEE"
      ? "Miembros del gimnasio"
      : "Usuarios del gimnasio";

  const pageDescription =
    session.role === "EMPLOYEE"
      ? `Registra y consulta miembros. Gimnasio: ${gym[0].name}`
      : `Registra empleados y miembros. Gimnasio: ${gym[0].name}`;

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
                {pageTitle}
              </h1>

              <p className="mt-1 text-sm text-neutral-500">
                {pageDescription}
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

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1fr_1.2fr]">
          <CreateGymUserForm currentRole={session.role} />

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">
                  {session.role === "EMPLOYEE"
                    ? "Miembros registrados"
                    : "Usuarios registrados"}
                </h2>

                <p className="mt-1 text-sm text-neutral-500">
                  {session.role === "EMPLOYEE"
                    ? "Lista de miembros registrados por el gimnasio."
                    : "Lista de administradores, empleados y miembros del gimnasio."}
                </p>
              </div>

              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                Total: {users.length}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {users.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-neutral-500">
                  Todavía no hay usuarios registrados.
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-2xl border bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-neutral-900">
                          {user.full_name}
                        </h3>

                        <p className="mt-1 text-sm text-neutral-500">
                          @{user.username} · {user.email}
                        </p>

                        <p className="text-sm text-neutral-500">
                          {user.phone || "Sin teléfono"}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                          {user.role}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            user.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {user.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <Info label="Usuario" value={`@${user.username}`} />
                      <Info label="Correo" value={user.email} />
                      <Info
                        label="Teléfono"
                        value={user.phone || "Sin teléfono"}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-neutral-800">
        {value}
      </p>
    </div>
  );
}