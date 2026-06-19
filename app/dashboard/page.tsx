import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardMenu from "@/components/DashboardMenu";

export const dynamic = "force-dynamic";

type DashboardStats = {
  total_gyms?: number;
  active_gyms?: number;
  suspended_gyms?: number;
  total_users?: number;

  gym_name?: string;
  gym_status?: string;
  total_employees?: number;
  total_members?: number;
  active_memberships?: number;
  about_to_expire_memberships?: number;
  expired_memberships?: number;
  total_products?: number;
  low_stock_products?: number;
  payments_current_month?: string | number;
  sales_current_month?: string | number;
};

type RecentMember = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
};

type RecentPayment = {
  id: string;
  member_name: string;
  amount: string | number;
  method: string;
  concept: string;
  status: string;
  payment_date: string;
};

type MemberDashboardData = {
  gym_name: string | null;
  gym_status: string | null;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
  membership_id: string | null;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  membership_status: string | null;
};

async function getDashboardStats(
  role: string,
  gymId: string | null
): Promise<DashboardStats> {
  if (role === "SUPER_ADMIN") {
    const result = await sql`
      select
        (select count(*)::int from gyms) as total_gyms,
        (select count(*)::int from gyms where status = 'ACTIVE') as active_gyms,
        (select count(*)::int from gyms where status = 'SUSPENDED') as suspended_gyms,
        (select count(*)::int from users) as total_users
    `;

    return result[0] || {};
  }

  if (!gymId || role === "MEMBER") {
    return {};
  }

  const result = await sql`
    select
      (select name from gyms where id = ${gymId} limit 1) as gym_name,
      (select status from gyms where id = ${gymId} limit 1) as gym_status,

      (select count(*)::int from users where gym_id = ${gymId} and role = 'EMPLOYEE') as total_employees,
      (select count(*)::int from users where gym_id = ${gymId} and role = 'MEMBER') as total_members,

      (select count(*)::int from memberships where gym_id = ${gymId} and status = 'ACTIVE') as active_memberships,
      (select count(*)::int from memberships where gym_id = ${gymId} and status = 'ABOUT_TO_EXPIRE') as about_to_expire_memberships,
      (select count(*)::int from memberships where gym_id = ${gymId} and status = 'EXPIRED') as expired_memberships,

      (select count(*)::int from products where gym_id = ${gymId}) as total_products,
      (select count(*)::int from products where gym_id = ${gymId} and stock <= min_stock) as low_stock_products,

      (
        select coalesce(sum(amount), 0)
        from payments
        where gym_id = ${gymId}
          and status = 'PAID'
          and date_trunc('month', payment_date) = date_trunc('month', now())
      ) as payments_current_month,

      (
        select coalesce(sum(total), 0)
        from sales
        where gym_id = ${gymId}
          and status = 'PAID'
          and date_trunc('month', created_at) = date_trunc('month', now())
      ) as sales_current_month
  `;

  return result[0] || {};
}

async function getRecentMembers(gymId: string | null) {
  if (!gymId) return [];

  const result = await sql`
    select
      id,
      full_name,
      username,
      email,
      phone,
      status,
      created_at
    from users
    where gym_id = ${gymId}
      and role = 'MEMBER'
    order by created_at desc
    limit 5
  `;

  return result as RecentMember[];
}

async function getRecentPayments(gymId: string | null) {
  if (!gymId) return [];

  const result = await sql`
    select
      p.id,
      u.full_name as member_name,
      p.amount,
      p.method,
      p.concept,
      p.status,
      p.payment_date
    from payments p
    join users u on u.id = p.member_id
    where p.gym_id = ${gymId}
    order by p.payment_date desc
    limit 5
  `;

  return result as RecentPayment[];
}

async function getMemberDashboardData(userId: string) {
  const result = await sql`
    select
      g.name as gym_name,
      g.status as gym_status,
      u.full_name,
      u.username,
      u.email,
      u.phone,
      m.id as membership_id,
      mp.name as plan_name,
      m.start_date,
      m.end_date,
      m.status as membership_status
    from users u
    left join gyms g on g.id = u.gym_id
    left join memberships m on m.member_id = u.id
    left join membership_plans mp on mp.id = m.plan_id
    where u.id = ${userId}
    order by m.created_at desc nulls last
    limit 1
  `;

  return (result[0] || null) as MemberDashboardData | null;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gym_session")?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await verifySessionToken(token);

  if (!session) {
    redirect("/login");
  }

  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  const stats = await getDashboardStats(session.role, session.gymId);

  const recentMembers =
    session.role === "GYM_ADMIN" || session.role === "EMPLOYEE"
      ? await getRecentMembers(session.gymId)
      : [];

  const recentPayments =
    session.role === "GYM_ADMIN" || session.role === "EMPLOYEE"
      ? await getRecentPayments(session.gymId)
      : [];

  const memberData =
    session.role === "MEMBER"
      ? await getMemberDashboardData(session.userId)
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
              Dashboard
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Bienvenido, {session.fullName}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          {session.role === "SUPER_ADMIN" && (
            <SuperAdminDashboard stats={stats} />
          )}

          {(session.role === "GYM_ADMIN" || session.role === "EMPLOYEE") && (
            <GymAdminDashboard
              stats={stats}
              role={session.role}
              recentMembers={recentMembers}
              recentPayments={recentPayments}
            />
          )}

          {session.role === "MEMBER" && (
            <MemberDashboard
              data={memberData}
              fallbackName={session.fullName}
              fallbackUsername={session.username}
              fallbackEmail={session.email}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number | string | undefined;
  description: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-neutral-500">{title}</p>

      <h3 className="mt-3 text-3xl font-bold text-neutral-900">
        {value ?? 0}
      </h3>

      <p className="mt-2 text-sm text-neutral-500">{description}</p>
    </div>
  );
}

function SuperAdminDashboard({ stats }: { stats: DashboardStats }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">
          Panel SUPER ADMIN
        </h2>

        <p className="text-neutral-500">
          Desde aquí podrás controlar gimnasios, pagos mensuales y suspensión
          del servicio.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        <StatCard
          title="Gimnasios registrados"
          value={stats.total_gyms}
          description="Total de gimnasios en el sistema"
        />

        <StatCard
          title="Gimnasios activos"
          value={stats.active_gyms}
          description="Clientes con acceso activo"
        />

        <StatCard
          title="Gimnasios suspendidos"
          value={stats.suspended_gyms}
          description="Clientes con servicio bloqueado"
        />

        <StatCard
          title="Usuarios totales"
          value={stats.total_users}
          description="Usuarios registrados en la plataforma"
        />
      </div>
    </div>
  );
}

function GymAdminDashboard({
  stats,
  role,
  recentMembers,
  recentPayments,
}: {
  stats: DashboardStats;
  role: string;
  recentMembers: RecentMember[];
  recentPayments: RecentPayment[];
}) {
  const isAdmin = role === "GYM_ADMIN";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Panel del gimnasio
          </p>

          <h2 className="mt-1 text-2xl font-bold text-neutral-900">
            {stats.gym_name || "Gimnasio"}
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Vista para rol: {role}
          </p>
        </div>

        <span
          className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${
            stats.gym_status === "ACTIVE"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {stats.gym_status || "SIN ESTADO"}
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        {isAdmin && (
          <StatCard
            title="Empleados"
            value={stats.total_employees}
            description="Usuarios internos del gimnasio"
          />
        )}

        <StatCard
          title="Miembros"
          value={stats.total_members}
          description="Clientes registrados"
        />

        <StatCard
          title="Membresías activas"
          value={stats.active_memberships}
          description="Clientes vigentes"
        />

        <StatCard
          title="Por vencer"
          value={stats.about_to_expire_memberships}
          description="Membresías próximas a vencer"
        />

        <StatCard
          title="Vencidas"
          value={stats.expired_memberships}
          description="Clientes pendientes de renovar"
        />

        <StatCard
          title="Pagos del mes"
          value={`$${Number(stats.payments_current_month || 0).toFixed(2)}`}
          description="Ingresos registrados por membresías"
        />

        <StatCard
          title="Ventas del mes"
          value={`$${Number(stats.sales_current_month || 0).toFixed(2)}`}
          description="Ingresos por productos"
        />

        <StatCard
          title="Productos"
          value={stats.total_products}
          description="Productos registrados"
        />

        <StatCard
          title="Bajo stock"
          value={stats.low_stock_products}
          description="Productos por reponer"
        />
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6">
        <h3 className="text-lg font-bold text-neutral-900">
          Acciones rápidas
        </h3>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ModuleLink title="Registrar usuarios" href="/dashboard/users" />
          <ModuleBox title="Registrar pagos" />
          <ModuleBox title="Crear membresía" />
          <ModuleBox title="Productos" />
          <ModuleBox title="Inventario" />
          <ModuleBox title="Ventas" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <RecentMembersList members={recentMembers} />
        <RecentPaymentsList payments={recentPayments} />
      </div>
    </div>
  );
}

function MemberDashboard({
  data,
  fallbackName,
  fallbackUsername,
  fallbackEmail,
}: {
  data: MemberDashboardData | null;
  fallbackName: string;
  fallbackUsername: string;
  fallbackEmail: string;
}) {
  const status = data?.membership_status || "SIN_MEMBRESIA";

  return (
    <div>
      <div className="mb-6 rounded-2xl bg-neutral-900 p-6 text-white shadow-sm">
        <p className="text-sm text-neutral-300">
          Panel del usuario
        </p>

        <h2 className="mt-2 text-3xl font-black">
          Hola, {data?.full_name || fallbackName}
        </h2>

        <p className="mt-2 text-sm text-neutral-300">
          Desde aquí puedes consultar tu membresía y tu información de acceso.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Estado de membresía
              </p>

              <h3 className="mt-2 text-2xl font-bold text-neutral-900">
                {getMembershipTitle(status)}
              </h3>

              <p className="mt-2 text-sm text-neutral-500">
                Gimnasio: {data?.gym_name || "No asignado"}
              </p>
            </div>

            <span className={getMembershipBadgeClass(status)}>
              {status}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MemberInfo
              label="Plan"
              value={data?.plan_name || "Sin plan activo"}
            />

            <MemberInfo
              label="Inicio"
              value={formatDate(data?.start_date)}
            />

            <MemberInfo
              label="Vence"
              value={formatDate(data?.end_date)}
            />
          </div>

          <div className="mt-6 rounded-xl bg-neutral-50 p-4">
            <p className="text-sm font-semibold text-neutral-800">
              Aviso
            </p>

            <p className="mt-1 text-sm leading-6 text-neutral-500">
              {getMembershipMessage(status)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-neutral-900">
            Mi cuenta
          </h3>

          <div className="mt-5 space-y-3">
            <MemberInfo
              label="Nombre"
              value={data?.full_name || fallbackName}
            />

            <MemberInfo
              label="Usuario"
              value={`@${data?.username || fallbackUsername}`}
            />

            <MemberInfo
              label="Correo"
              value={data?.email || fallbackEmail}
            />

            <MemberInfo
              label="Teléfono"
              value={data?.phone || "Sin teléfono"}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-neutral-900">
          Opciones disponibles
        </h3>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ModuleBox title="Ver catálogo" />
          <ModuleBox title="Historial de pagos" />
          <ModuleBox title="Actualizar mis datos" />
        </div>
      </div>
    </div>
  );
}

function RecentMembersList({ members }: { members: RecentMember[] }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-neutral-900">
        Últimos miembros registrados
      </h3>

      <div className="mt-5 space-y-3">
        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
            Todavía no hay miembros registrados.
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="rounded-xl border bg-neutral-50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-neutral-900">
                    {member.full_name}
                  </p>

                  <p className="mt-1 text-sm text-neutral-500">
                    @{member.username} · {member.email}
                  </p>

                  <p className="text-sm text-neutral-500">
                    {member.phone || "Sin teléfono"}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    member.status === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {member.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentPaymentsList({ payments }: { payments: RecentPayment[] }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-neutral-900">
        Últimos pagos registrados
      </h3>

      <div className="mt-5 space-y-3">
        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
            Todavía no hay pagos registrados.
          </div>
        ) : (
          payments.map((payment) => (
            <div
              key={payment.id}
              className="rounded-xl border bg-neutral-50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-neutral-900">
                    {payment.member_name}
                  </p>

                  <p className="mt-1 text-sm text-neutral-500">
                    {payment.concept} · {payment.method}
                  </p>

                  <p className="text-sm text-neutral-500">
                    {new Date(payment.payment_date).toLocaleDateString("es-SV")}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-neutral-900">
                    ${Number(payment.amount || 0).toFixed(2)}
                  </p>

                  <span className="mt-1 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    {payment.status}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MemberInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function ModuleLink({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
    >
      {title}
    </a>
  );
}

function ModuleBox({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm font-semibold text-neutral-700">
      {title}
    </div>
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

function getMembershipTitle(status: string) {
  if (status === "ACTIVE") return "Tu membresía está activa";
  if (status === "ABOUT_TO_EXPIRE") return "Tu membresía está por vencer";
  if (status === "EXPIRED") return "Tu membresía está vencida";
  if (status === "CANCELLED") return "Tu membresía fue cancelada";
  return "Aún no tienes membresía activa";
}

function getMembershipMessage(status: string) {
  if (status === "ACTIVE") {
    return "Tu membresía se encuentra vigente. Puedes continuar usando los servicios del gimnasio.";
  }

  if (status === "ABOUT_TO_EXPIRE") {
    return "Tu membresía está próxima a vencer. Acércate al gimnasio para renovar tu plan.";
  }

  if (status === "EXPIRED") {
    return "Tu membresía ya venció. Debes renovar para continuar usando los servicios del gimnasio.";
  }

  if (status === "CANCELLED") {
    return "Tu membresía fue cancelada. Contacta con el personal del gimnasio para más información.";
  }

  return "Actualmente no tienes una membresía registrada. Contacta con el personal del gimnasio.";
}

function getMembershipBadgeClass(status: string) {
  if (status === "ACTIVE") {
    return "w-fit rounded-full bg-green-100 px-4 py-2 text-xs font-bold text-green-700";
  }

  if (status === "ABOUT_TO_EXPIRE") {
    return "w-fit rounded-full bg-yellow-100 px-4 py-2 text-xs font-bold text-yellow-700";
  }

  if (status === "EXPIRED") {
    return "w-fit rounded-full bg-red-100 px-4 py-2 text-xs font-bold text-red-700";
  }

  if (status === "CANCELLED") {
    return "w-fit rounded-full bg-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700";
  }

  return "w-fit rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700";
}