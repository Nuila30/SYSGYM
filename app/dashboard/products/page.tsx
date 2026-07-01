import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import ProductsManager from "@/components/ProductsManager";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  name: string;
  image_url?: string | null;
  price: string | number;
  stock: number;
  stock_entry_date?: string | null;
  is_active: boolean;
};

async function getProducts(gymId: string) {
  const products = await sql`
    select
      id,
      name,
      image_url,
      price,
      stock,
      to_char(stock_entry_date, 'YYYY-MM-DD') as stock_entry_date,
      is_active
    from products
    where gym_id = ${gymId}
    order by name asc
  `;

  return products as Product[];
}

export default async function ProductsPage() {
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
              Productos
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Administra nombre, imagen y precio de los productos.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <ProductsManager
            products={products}
            canManage={session.role === "GYM_ADMIN"}
          />
        </div>
      </section>
    </main>
  );
}