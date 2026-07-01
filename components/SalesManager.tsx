"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

const paymentMethods = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "OTHER", label: "Otro" },
];

export default function SalesManager({
  products: rawProducts,
  salesSummary: rawSalesSummary,
  recentSales: rawRecentSales,
  canCancel,
}: {
  products?: Product[];
  salesSummary?: ProductSaleSummary[];
  recentSales?: RecentSale[];
  canCancel: boolean;
}) {
  const router = useRouter();

  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const salesSummary = Array.isArray(rawSalesSummary) ? rawSalesSummary : [];
  const recentSales = Array.isArray(rawRecentSales) ? rawRecentSales : [];

  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [loadingCancelId, setLoadingCancelId] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const activeProducts = products.filter((product) => product.is_active);

  const filteredProducts = activeProducts.filter((product) => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return true;

    return product.name.toLowerCase().includes(term);
  });

  const totalRevenue = salesSummary.reduce(
    (sum, product) => sum + Number(product.revenue || 0),
    0
  );

  const totalUnits = salesSummary.reduce(
    (sum, product) => sum + Number(product.units_sold || 0),
    0
  );

  const mostSold = [...salesSummary]
    .filter((product) => Number(product.units_sold || 0) > 0)
    .sort((a, b) => Number(b.units_sold || 0) - Number(a.units_sold || 0))[0];

  const leastSold = [...salesSummary]
    .filter((product) => Number(product.units_sold || 0) > 0)
    .sort((a, b) => Number(a.units_sold || 0) - Number(b.units_sold || 0))[0];

  function getQuantity(productId: string) {
    return quantities[productId] || 1;
  }

  function setProductQuantity(productId: string, value: number, stock: number) {
    const cleanValue = Math.max(1, Math.trunc(value || 1));
    const limitedValue = stock > 0 ? Math.min(cleanValue, stock) : 1;

    setQuantities((current) => ({
      ...current,
      [productId]: limitedValue,
    }));
  }

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);

      return {
        ok: false,
        message:
          "La API no respondió correctamente. Revisa app/api/gym/sales/route.ts",
      };
    }
  }

  async function sellProduct(product: Product) {
    const quantity = getQuantity(product.id);
    const stock = Number(product.stock || 0);

    if (stock <= 0) {
      setMessage("Este producto no tiene stock disponible");
      return;
    }

    if (quantity <= 0) {
      setMessage("La cantidad debe ser mayor a 0");
      return;
    }

    if (quantity > stock) {
      setMessage(`Stock insuficiente. Disponible: ${stock}`);
      return;
    }

    setLoadingProductId(product.id);
    setMessage("");

    try {
      const res = await fetch("/api/gym/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          paymentMethod,
          saleDate: today,
          referenceCode: "",
          notes: "",
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al registrar venta");
        return;
      }

      setQuantities((current) => ({
        ...current,
        [product.id]: 1,
      }));

      setMessage(data.message || "Venta registrada correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error registrando venta:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingProductId(null);
    }
  }

  async function cancelSale(saleId: string) {
    const confirmed = window.confirm(
      "¿Seguro que deseas cancelar esta venta? El stock será restaurado."
    );

    if (!confirmed) return;

    setLoadingCancelId(saleId);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/sales?saleId=${encodeURIComponent(saleId)}`,
        {
          method: "DELETE",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al cancelar venta");
        return;
      }

      setMessage(data.message || "Venta cancelada correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error cancelando venta:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingCancelId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Total vendido" value={`$${totalRevenue.toFixed(2)}`} />
        <SummaryCard title="Unidades vendidas" value={String(totalUnits)} />
        <SummaryCard title="Más vendido" value={mostSold ? mostSold.name : "Sin datos"} />
        <SummaryCard title="Menos vendido" value={leastSold ? leastSold.name : "Sin datos"} />
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Venta rápida
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Selecciona un producto y presiona vender. La fecha, precio, total
              y descuento de stock se hacen automáticamente.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_220px] xl:w-[620px]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">
                Buscar producto
              </span>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ej. agua, proteína, bebida..."
                className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">
                Método
              </span>

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {message && (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              message.toLowerCase().includes("correctamente") ||
              message.toLowerCase().includes("registrada")
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500 md:col-span-2 xl:col-span-3">
              No hay productos disponibles para vender.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const quantity = getQuantity(product.id);
              const price = Number(product.price || 0);
              const stock = Number(product.stock || 0);
              const total = price * quantity;
              const loading = loadingProductId === product.id;

              return (
                <div
                  key={product.id}
                  className={`rounded-2xl border p-4 ${
                    stock <= 0 ? "bg-neutral-50 opacity-70" : "bg-white"
                  }`}
                >
                  <div className="flex gap-4">
                    <ProductImage imageUrl={product.image_url} name={product.name} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-neutral-950">
                          {product.name}
                        </h3>

                        <StockBadge stock={stock} />
                      </div>

                      <p className="mt-2 text-2xl font-black text-neutral-950">
                        ${price.toFixed(2)}
                      </p>

                      <p className="mt-1 text-sm text-neutral-500">
                        Precio por unidad
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-neutral-700">
                        Cantidad
                      </p>

                      <div className="flex items-center rounded-xl border bg-white">
                        <button
                          type="button"
                          onClick={() =>
                            setProductQuantity(product.id, quantity - 1, stock)
                          }
                          disabled={stock <= 0 || quantity <= 1}
                          className="h-10 w-10 font-black text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          -
                        </button>

                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) =>
                            setProductQuantity(
                              product.id,
                              Number(e.target.value),
                              stock
                            )
                          }
                          disabled={stock <= 0}
                          className="h-10 w-16 border-x bg-white text-center font-bold text-neutral-900 outline-none disabled:cursor-not-allowed"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setProductQuantity(product.id, quantity + 1, stock)
                          }
                          disabled={stock <= 0 || quantity >= stock}
                          className="h-10 w-10 font-black text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-neutral-500">Total</p>

                      <p className="text-xl font-black text-neutral-950">
                        ${total.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => sellProduct(product)}
                    disabled={loading || stock <= 0}
                    className="mt-4 w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? "Vendiendo..."
                      : stock <= 0
                      ? "Sin stock"
                      : "Vender"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Productos más y menos vendidos
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Ranking basado en unidades vendidas.
        </p>

        <div className="mt-6 space-y-4">
          {salesSummary.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Todavía no hay productos para analizar.
            </div>
          ) : (
            salesSummary.map((product, index) => (
              <div
                key={product.id}
                className="grid gap-4 rounded-2xl border p-4 md:grid-cols-[60px_1fr_150px_150px]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-sm font-black text-neutral-700">
                  #{index + 1}
                </div>

                <div>
                  <h3 className="font-bold text-neutral-950">{product.name}</h3>

                  <p className="mt-1 text-sm text-neutral-500">
                    Precio: ${Number(product.price || 0).toFixed(2)} · Stock:{" "}
                    {product.stock}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-neutral-500">Unidades vendidas</p>

                  <p className="mt-1 text-lg font-black text-neutral-950">
                    {product.units_sold}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-neutral-500">Ingresos</p>

                  <p className="mt-1 text-lg font-black text-neutral-950">
                    ${Number(product.revenue || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Últimas ventas</h2>

        <div className="mt-6 space-y-4">
          {recentSales.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Todavía no hay ventas registradas.
            </div>
          ) : (
            recentSales.map((sale) => (
              <div key={sale.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-950">
                      {sale.product_name || "Producto"}
                    </h3>

                    <p className="mt-1 text-sm text-neutral-500">
                      Cantidad: {sale.quantity || 0} · Precio: $
                      {Number(sale.unit_price || 0).toFixed(2)} ·{" "}
                      {formatDate(sale.sale_date)}
                    </p>

                    <p className="mt-1 text-xs text-neutral-400">
                      Registrado por: {sale.created_by_name || "Usuario"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-black text-neutral-900">
                      ${Number(sale.total || 0).toFixed(2)}
                    </span>

                    <StatusBadge status={sale.status} />

                    {canCancel && sale.status === "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => cancelSale(sale.id)}
                        disabled={loadingCancelId === sale.id}
                        className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingCancelId === sale.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-neutral-500">{title}</p>

      <p className="mt-2 break-words text-xl font-black text-neutral-950">
        {value}
      </p>
    </div>
  );
}

function ProductImage({
  imageUrl,
  name,
}: {
  imageUrl?: string | null;
  name: string;
}) {
  if (!imageUrl) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-center text-xs font-bold text-neutral-400">
        Sin imagen
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className="h-20 w-20 shrink-0 rounded-2xl object-cover"
    />
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
        Sin stock
      </span>
    );
  }

  if (stock <= 3) {
    return (
      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
        Stock bajo: {stock}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
      Stock: {stock}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const completed = status === "COMPLETED";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        completed
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {completed ? "COMPLETADA" : "CANCELADA"}
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