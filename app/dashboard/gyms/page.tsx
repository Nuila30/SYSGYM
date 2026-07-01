import Link from "next/link";
import { sql } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import CreateGymForm from "@/components/CreateGymForm";
import DashboardMenu from "@/components/DashboardMenu";
import GymsManager from "@/components/GymsManager";

export const dynamic = "force-dynamic";

type GymRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  created_at: string;
  system_plan_id: string | null;
  plan_name: string | null;
  monthly_fee: string | number | null;
  access_days: number | null;
  end_date: string | null;
  subscription_status: string | null;
  admin_full_name: string | null;
  admin_username: string | null;
  admin_email: string | null;
};

type SystemPlan = {
  id: string;
  name: string;
  code: string;
  monthly_fee: string | number;
  access_days: number;
  description: string | null;
  features: string[] | null;
  restrictions: string[] | null;
};

async function getGyms() {
  const gyms = await sql`
    select
      g.id,
      g.name,
      coalesce(g.phone, '') as phone,
      coalesce(g.email, '') as email,
      coalesce(g.address, '') as address,
      g.status::text as status,
      g.created_at,
      ss.system_plan_id,
      coalesce(sp.name, ss.plan_name, 'Plan Mensual') as plan_name,
      coalesce(sp.monthly_fee, ss.monthly_fee, 0) as monthly_fee,
      coalesce(ss.access_days, sp.access_days, 30) as access_days,
      to_char(ss.end_date, 'YYYY-MM-DD') as end_date,
      coalesce(ss.status::text, g.status::text) as subscription_status,
      u.full_name as admin_full_name,
      u.username as admin_username,
      u.email as admin_email
    from gyms g
    left join lateral (
      select
        system_plan_id,
        plan_name,
        monthly_fee,
        access_days,
        end_date,
        status,
        created_at
      from system_subscriptions
      where gym_id = g.id
      order by created_at desc
      limit 1
    ) ss on true
    left join system_plans sp on sp.id = ss.system_plan_id
    left join lateral (
      select
        full_name,
        username,
        email
      from users
      where gym_id = g.id
        and role = 'GYM_ADMIN'
      order by created_at asc
      limit 1
    ) u on true
    order by g.created_at desc
  `;

  return gyms as GymRow[];
}

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
      restrictions
    from system_plans
    where is_active = true
    order by monthly_fee asc, created_at asc
  `;

  return plans as SystemPlan[];
}

export default async function GymsPage() {
  const session = await requireSuperAdmin();

  const [gyms, plans] = await Promise.all([getGyms(), getPlans()]);

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
                Registra clientes, asigna planes y controla su acceso.
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
          <CreateGymForm plans={plans} />

          <GymsManager gyms={gyms} plans={plans} />
        </section>
      </section>
    </main>
  );
}