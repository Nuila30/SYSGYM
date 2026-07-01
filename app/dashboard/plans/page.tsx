import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import PlansManager from "@/components/PlansManager";

export const dynamic = "force-dynamic";

type SystemPlan = {
  id: string;
  name: string;
  code: string;
  monthly_fee: string | number;
  access_days: number;
  description: string | null;
  features: string[] | null;
  restrictions: string[] | null;
  max_employees: number | null;
  max_members: number | null;
  max_products: number | null;
  can_use_inventory: boolean;
  can_use_sales: boolean;
  can_use_attendance: boolean;
  can_use_reports: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function getPlans() {
  const plans = await sql`
  select
    id,
    name,
    code,
    monthly_fee,
    access_days,
    description,
    features,
    restrictions,
    max_employees,
    max_members,
    max_products,
    can_use_inventory,
    can_use_sales,
    can_use_attendance,
    can_use_reports,
    is_active,
    created_at,
    updated_at
  from system_plans
  order by monthly_fee asc, created_at asc
`;;

  return plans as SystemPlan[];
}

export default async function PlansPage() {
  const session = await requireSuperAdmin();
  const plans = await getPlans();

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
                Planes del sistema
              </h1>

              <p className="mt-1 text-sm text-neutral-500">
                Crea, edita y administra los planes que se asignan a cada gimnasio.
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
          <PlansManager plans={plans} />
        </div>
      </section>
    </main>
  );
}