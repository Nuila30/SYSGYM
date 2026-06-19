import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireSession } from "@/lib/session";
import DashboardMenu from "@/components/DashboardMenu";
import InventoryManager from "@/components/InventoryManager";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  name: string;
  category?: string | null;
  price: string | number;
  stock: number;
  min_stock: number;
  is_active: boolean;
};

type InventoryMovement = {
  id: string;
  product_id: string;
  product_name: string;
  category?: string | null;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string | null;
  created_at: string;
  created_by_name?: string | null;
};

async function getProducts(gymId: string) {
  const products = await sql`
    select
      id,
      name,
      category,
      price,
      stock,
      min_stock,
      is_active
    from products
    where gym_id = ${gymId}
    order by name asc
  `;

  return products as Product[];
}

async function getInventoryMovements(gymId: string) {
  const movements = await sql`
    select
      im.id,
      im.product_id,
      im.movement_type,
      im.quantity,
      im.previous_stock,
      im.new_stock,
      im.reason,
      im.created_at,
      p.name as product_name,
      p.category,
      u.full_name as created_by_name
    from inventory_movements im
    join products p on p.id = im.product_id
    left join users u on u.id = im.created_by
    where im.gym_id = ${gymId}
    order by im.created_at desc
    limit 100
  `;

  return movements as InventoryMovement[];
}

export default async function InventoryPage() {
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
  const movements = await getInventoryMovements(session.gymId);

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
              Inventario
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Controla stock, entradas, salidas y ajustes de productos.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <InventoryManager products={products} movements={movements} />
        </div>
      </section>
    </main>
  );
}