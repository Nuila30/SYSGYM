import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import MembershipPlansManager from "@/components/MembershipPlansManager";
import AssignMembershipForm from "@/components/AssignMembershipForm";
import MembershipRequestsPanel from "@/components/MembershipRequestsPanel";
import MemberMembershipRequestForm from "@/components/MemberMembershipRequestForm";

export const dynamic = "force-dynamic";

type MembershipPlan = {
  id: string;
  gym_id: string;
  name: string;
  duration_days: number;
  price: string | number;
  schedule: string | null;
  is_active: boolean;
  created_at: string;
};

type MemberUser = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
};

type MembershipRow = {
  id: string;
  member_name: string;
  username: string;
  plan_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
};

type MembershipRequest = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  member_name?: string;
  username?: string;
  plan_name: string;
  duration_days: number;
  price: string | number;
  schedule?: string | null;
};

async function getPlans(gymId: string) {
  const plans = await sql`
    select
      id,
      gym_id,
      name,
      duration_days,
      price,
      coalesce(schedule, 'Consultar horarios disponibles en el local') as schedule,
      is_active,
      created_at
    from membership_plans
    where gym_id = ${gymId}
    order by duration_days asc, created_at desc
  `;

  return plans as MembershipPlan[];
}

async function getMembers(gymId: string) {
  const members = await sql`
    select
      id,
      full_name,
      username,
      email,
      phone
    from users
    where gym_id = ${gymId}
      and role = 'MEMBER'
      and status = 'ACTIVE'
    order by full_name asc
  `;

  return members as MemberUser[];
}

async function getMemberships(gymId: string) {
  const memberships = await sql`
    select
      m.id,
      u.full_name as member_name,
      u.username,
      mp.name as plan_name,
      m.start_date,
      m.end_date,
      m.status,
      m.created_at
    from memberships m
    join users u on u.id = m.member_id
    left join membership_plans mp on mp.id = m.plan_id
    where m.gym_id = ${gymId}
    order by m.created_at desc
  `;

  return memberships as MembershipRow[];
}

async function getRequests(gymId: string, userId: string, role: string) {
  if (role === "MEMBER") {
    const requests = await sql`
      select
        mr.id,
        mr.status,
        mr.notes,
        mr.created_at,
        mp.name as plan_name,
        mp.duration_days,
        mp.price,
        mp.schedule
      from membership_requests mr
      join membership_plans mp on mp.id = mr.plan_id
      where mr.member_id = ${userId}
      order by mr.created_at desc
    `;

    return requests as MembershipRequest[];
  }

  const requests = await sql`
    select
      mr.id,
      mr.status,
      mr.notes,
      mr.created_at,
      u.full_name as member_name,
      u.username,
      mp.name as plan_name,
      mp.duration_days,
      mp.price,
      mp.schedule
    from membership_requests mr
    join users u on u.id = mr.member_id
    join membership_plans mp on mp.id = mr.plan_id
    where mr.gym_id = ${gymId}
    order by mr.created_at desc
  `;

  return requests as MembershipRequest[];
}

async function getCurrentMemberMembership(userId: string) {
  const result = await sql`
    select
      m.id,
      mp.name as plan_name,
      m.start_date,
      m.end_date,
      m.status
    from memberships m
    left join membership_plans mp on mp.id = m.plan_id
    where m.member_id = ${userId}
    order by m.created_at desc
    limit 1
  `;

  return result[0] || null;
}

export default async function MembershipsPage() {
  const session = await requireSession();

  if (!session.gymId) {
    redirect("/dashboard");
  }

  if (!["GYM_ADMIN", "EMPLOYEE", "MEMBER"].includes(session.role)) {
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

  const plans = await getPlans(session.gymId);
  const activePlans = plans.filter((plan) => plan.is_active);

  const requests = await getRequests(
    session.gymId,
    session.userId,
    session.role
  );

  const members =
    session.role === "GYM_ADMIN" || session.role === "EMPLOYEE"
      ? await getMembers(session.gymId)
      : [];

  const memberships =
    session.role === "GYM_ADMIN" || session.role === "EMPLOYEE"
      ? await getMemberships(session.gymId)
      : [];

  const currentMembership =
    session.role === "MEMBER"
      ? await getCurrentMemberMembership(session.userId)
      : null;

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
              Membresías
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Gimnasio: {gym[0].name}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          {session.role === "GYM_ADMIN" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <MembershipPlansManager plans={plans} />

              <AssignMembershipForm members={members} plans={activePlans} />
            </div>
          )}

          {session.role === "EMPLOYEE" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <AssignMembershipForm members={members} plans={activePlans} />

              <InfoBox
                title="Permisos del empleado"
                description="Puedes asignar membresías y aprobar solicitudes de miembros. No puedes crear, editar ni eliminar planes."
              />
            </div>
          )}

          {session.role === "MEMBER" && (
            <MemberMembershipRequestForm
              plans={activePlans}
              requests={requests}
              currentMembership={currentMembership}
            />
          )}

          {(session.role === "GYM_ADMIN" || session.role === "EMPLOYEE") && (
            <>
              <div className="mt-8">
                <MembershipRequestsPanel requests={requests} />
              </div>

              <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">
                      Membresías asignadas
                    </h2>

                    <p className="mt-1 text-sm text-neutral-500">
                      Historial de membresías registradas en el gimnasio.
                    </p>
                  </div>

                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                    Total: {memberships.length}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {memberships.length === 0 ? (
                    <EmptyMessage message="Todavía no hay membresías asignadas." />
                  ) : (
                    memberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="rounded-2xl border bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-bold text-neutral-900">
                              {membership.member_name}
                            </h3>

                            <p className="mt-1 text-sm text-neutral-500">
                              @{membership.username} ·{" "}
                              {membership.plan_name || "Sin plan"}
                            </p>
                          </div>

                          <StatusBadge status={membership.status} />
                        </div>

                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                          <Info
                            label="Inicio"
                            value={formatDate(membership.start_date)}
                          />

                          <Info
                            label="Vence"
                            value={formatDate(membership.end_date)}
                          />

                          <Info label="Estado" value={membership.status} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function InfoBox({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-neutral-900">{title}</h2>

      <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-sm text-neutral-500">
      {message}
    </div>
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

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "ACTIVE" || status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : status === "ABOUT_TO_EXPIRE" || status === "PENDING"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {status}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}