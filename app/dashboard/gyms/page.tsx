import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import CreateGymForm from "@/components/CreateGymForm";
import GymStatusActions from "@/components/GymStatusActions";
import DashboardMenu from "@/components/DashboardMenu";

export const dynamic = "force-dynamic";

type GymRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  created_at: string;
  plan_name: string | null;
  monthly_fee: string | null;
  subscription_end_date: string | null;
  subscription_status: string | null;
};

async function getGyms() {
  const gyms = await sql`
    select
      g.id,
      g.name,
      g.phone,
      g.email,
      g.address,
      g.status,
      g.created_at,
      ss.plan_name,
      ss.monthly_fee,
      ss.end_date as subscription_end_date,
      ss.status as subscription_status
    from gyms g
    left join system_subscriptions ss on ss.gym_id = g.id
    order by g.created_at desc
  `;

  return gyms as GymRow[];
}

export default async function GymsPage() {
  const session = await requireSuperAdmin();
  const gyms = await getGyms();

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
                Gestión de gimnasios
              </h1>

              <p className="mt-1 text-sm text-neutral-500">
                Registra clientes, crea sus administradores y controla su acceso.
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
          <CreateGymForm />

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">
                  Gimnasios registrados
                </h2>

                <p className="mt-1 text-sm text-neutral-500">
                  Lista de gimnasios activos o suspendidos dentro del SaaS.
                </p>
              </div>

              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                Total: {gyms.length}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {gyms.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-neutral-500">
                  Todavía no hay gimnasios registrados.
                </div>
              ) : (
                gyms.map((gym) => (
                  <div
                    key={gym.id}
                    className="rounded-2xl border bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-neutral-900">
                          {gym.name}
                        </h3>

                        <p className="mt-1 text-sm text-neutral-500">
                          {gym.email || "Sin correo"} ·{" "}
                          {gym.phone || "Sin teléfono"}
                        </p>

                        <p className="text-sm text-neutral-500">
                          {gym.address || "Sin dirección"}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            gym.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {gym.status}
                        </span>

                        {gym.subscription_status && (
                          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                            {gym.subscription_status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <Info label="Plan" value={gym.plan_name || "Sin plan"} />

                      <Info
                        label="Mensualidad"
                        value={`$${gym.monthly_fee || "0.00"}`}
                      />

                      <Info
                        label="Vence"
                        value={
                          gym.subscription_end_date
                            ? new Date(
                                gym.subscription_end_date
                              ).toLocaleDateString("es-SV")
                            : "Sin fecha"
                        }
                      />
                    </div>

                    <GymStatusActions
                      gymId={gym.id}
                      currentStatus={gym.status}
                    />
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
      <p className="mt-1 font-semibold text-neutral-800">{value}</p>
    </div>
  );
}