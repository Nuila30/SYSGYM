import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import SalesManager from "@/components/SalesManager";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  name: string;
  image_url?: string | null;
  price: string | number;
  stock: number;
  is_active: boolean;
};

type ProductSaleSummary = {
  id: string;
  name: string;
  image_url?: string | null;
  price: string | number;
  stock: number;
  units_sold: number;
  revenue: string | number;
};

type RecentSale = {
  id: string;
  total: string | number;
  payment_method: string;
  sale_date: string;
  status: string;
  product_name: string | null;
  quantity: number | null;
  unit_price: string | number | null;
  created_by_name?: string | null;
};

async function getProducts(gymId: string) {
  const products = await sql`
    select
      id,
      name,
      image_url,
      price,
      stock,
      is_active
    from products
    where gym_id = ${gymId}
    order by name asc
  `;

  return products as Product[];
}

async function getSalesSummary(gymId: string) {
  const summary = await sql`
    select
      p.id,
      p.name,
      p.image_url,
      p.price,
      p.stock,
      coalesce(
        sum(
          case
            when s.status = 'COMPLETED' then si.quantity
            else 0
          end
        ),
        0
      )::int as units_sold,
      coalesce(
        sum(
          case
            when s.status = 'COMPLETED' then si.subtotal
            else 0
          end
        ),
        0
      ) as revenue
    from products p
    left join sale_items si on si.product_id = p.id
      and si.gym_id = p.gym_id
    left join sales s on s.id = si.sale_id
      and s.gym_id = p.gym_id
    where p.gym_id = ${gymId}
    group by
      p.id,
      p.name,
      p.image_url,
      p.price,
      p.stock
    order by units_sold desc, revenue desc, p.name asc
  `;

  return summary as ProductSaleSummary[];
}

async function getRecentSales(gymId: string) {
  const sales = await sql`
    select
      s.id,
      s.total,
      s.payment_method,
      s.sale_date,
      s.status,
      p.name as product_name,
      si.quantity,
      si.unit_price,
      u.full_name as created_by_name
    from sales s
    left join sale_items si on si.sale_id = s.id
    left join products p on p.id = si.product_id
    left join users u on u.id = s.created_by
    where s.gym_id = ${gymId}
    order by s.created_at desc
    limit 30
  `;

  return sales as RecentSale[];
}

export default async function SalesPage() {
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

  const products = await getProducts(session.gymId);
  const salesSummary = await getSalesSummary(session.gymId);
  const recentSales = await getRecentSales(session.gymId);

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
              Ventas
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Registra ventas y consulta qué productos se venden más o menos.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <SalesManager
            products={products}
            salesSummary={salesSummary}
            recentSales={recentSales}
            canCancel={session.role === "GYM_ADMIN"}
          />
        </div>
      </section>
    </main>
  );
}