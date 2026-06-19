import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import SalesManager from "@/components/SalesManager";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  name: string;
  category?: string | null;
  price: string | number;
  stock: number;
  is_active: boolean;
};

type Sale = {
  id: string;
  total: string | number;
  payment_method: string;
  reference_code?: string | null;
  notes?: string | null;
  sale_date: string;
  status: string;
  created_at: string;
  created_by_name?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  category?: string | null;
  quantity?: number | null;
  unit_price?: string | number | null;
  subtotal?: string | number | null;
};

async function getProducts(gymId: string) {
  const products = await sql`
    select
      id,
      name,
      category,
      price,
      stock,
      is_active
    from products
    where gym_id = ${gymId}
    order by name asc
  `;

  return products as Product[];
}

async function getSales(gymId: string) {
  const sales = await sql`
    select
      s.id,
      s.total,
      s.payment_method,
      s.reference_code,
      s.notes,
      s.sale_date,
      s.status,
      s.created_at,
      u.full_name as created_by_name,
      si.product_id,
      si.quantity,
      si.unit_price,
      si.subtotal,
      p.name as product_name,
      p.category
    from sales s
    left join users u on u.id = s.created_by
    left join sale_items si on si.sale_id = s.id
    left join products p on p.id = si.product_id
    where s.gym_id = ${gymId}
    order by s.sale_date desc, s.created_at desc
  `;

  return sales as Sale[];
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
  const sales = await getSales(session.gymId);

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
              Registra ventas de productos y descuenta inventario
              automáticamente.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <SalesManager
            products={products}
            sales={sales}
            canCancel={session.role === "GYM_ADMIN"}
          />
        </div>
      </section>
    </main>
  );
}