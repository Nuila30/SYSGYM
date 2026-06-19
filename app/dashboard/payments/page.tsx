import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import PaymentsManager from "@/components/PaymentsManager";

export const dynamic = "force-dynamic";

type Payment = {
  id: string;
  membership_id: string | null;
  member_id: string;
  amount: string | number;
  method: string;
  reference_code?: string | null;
  notes?: string | null;
  payment_date: string;
  status: string;
  created_at: string;
  member_name: string;
  username: string;
  plan_name?: string | null;
};

type MembershipOption = {
  id: string;
  member_id: string;
  member_name: string;
  username: string;
  plan_name: string | null;
  plan_price: string | number | null;
  start_date: string;
  end_date: string;
  status: string;
};

async function getPayments(gymId: string) {
  const payments = await sql`
    select
      p.id,
      p.membership_id,
      p.member_id,
      p.amount,
      p.method,
      p.reference_code,
      p.notes,
      p.payment_date,
      p.status,
      p.created_at,
      u.full_name as member_name,
      u.username,
      mp.name as plan_name
    from payments p
    join users u on u.id = p.member_id
    left join memberships m on m.id = p.membership_id
    left join membership_plans mp on mp.id = m.plan_id
    where p.gym_id = ${gymId}
    order by p.payment_date desc, p.created_at desc
  `;

  return payments as Payment[];
}

async function getMembershipOptions(gymId: string) {
  const memberships = await sql`
    select
      m.id,
      m.member_id,
      u.full_name as member_name,
      u.username,
      mp.name as plan_name,
      mp.price as plan_price,
      m.start_date,
      m.end_date,
      m.status
    from memberships m
    join users u on u.id = m.member_id
    left join membership_plans mp on mp.id = m.plan_id
    where m.gym_id = ${gymId}
      and m.status in ('ACTIVE', 'ABOUT_TO_EXPIRE')
    order by u.full_name asc, m.created_at desc
  `;

  return memberships as MembershipOption[];
}

export default async function PaymentsPage() {
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

  const payments = await getPayments(session.gymId);
  const memberships = await getMembershipOptions(session.gymId);

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
            <h1 className="text-2xl font-bold text-neutral-900">Pagos</h1>

            <p className="mt-1 text-sm text-neutral-500">
              Registra y consulta pagos de membresías realizados en el gimnasio.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <PaymentsManager
            payments={payments}
            memberships={memberships}
            canEdit={session.role === "GYM_ADMIN"}
          />
        </div>
      </section>
    </main>
  );
}