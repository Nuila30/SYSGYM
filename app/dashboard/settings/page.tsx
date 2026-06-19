import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import SettingsManager from "@/components/SettingsManager";

export const dynamic = "force-dynamic";

type UserAccount = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
};

async function getUser(userId: string) {
  const user = await sql`
    select
      id,
      full_name,
      username,
      email,
      phone,
      role,
      status
    from users
    where id = ${userId}
    limit 1
  `;

  return user[0] as UserAccount | undefined;
}

export default async function SettingsPage() {
  const session = await requireSession();

  const user = await getUser(session.userId);

  if (!user) {
    redirect("/login");
  }

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
              Configuración
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Administra tu cuenta, contraseña y preferencias del sistema.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <SettingsManager user={user} />
        </div>
      </section>
    </main>
  );
}