"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
  sales: rawSales,
  canCancel,
}: {
  products?: Product[];
  sales?: Sale[];
  canCancel: boolean;
}) {
  const router = useRouter();

  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const sales = Array.isArray(rawSales) ? rawSales : [];

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceCode, setReferenceCode] = useState("");
  const [saleDate, setSaleDate] = useState(today);
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedProduct = products.find((product) => product.id === productId);
  const selectedPrice = Number(selectedProduct?.price || 0);
  const selectedStock = Number(selectedProduct?.stock || 0);
  const total = selectedPrice * Number(quantity || 0);

  const completedSales = sales.filter((sale) => sale.status === "COMPLETED");

  const totalSold = completedSales.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  );

  const totalUnits = completedSales.reduce(
    (sum, sale) => sum + Number(sale.quantity || 0),
    0
  );

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

  async function createSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!productId) {
      setMessage("Selecciona un producto");
      return;
    }

    if (Number(quantity || 0) <= 0) {
      setMessage("La cantidad debe ser mayor a 0");
      return;
    }

    if (Number(quantity || 0) > selectedStock) {
      setMessage(`Stock insuficiente. Disponible: ${selectedStock}`);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity: Number(quantity),
          paymentMethod,
          referenceCode: referenceCode.trim(),
          saleDate,
          notes: notes.trim(),
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al registrar venta");
        return;
      }

      setProductId("");
      setQuantity("1");
      setPaymentMethod("CASH");
      setReferenceCode("");
      setSaleDate(today);
      setNotes("");

      setMessage(data.message || "Venta registrada correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error registrando venta:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function cancelSale(saleId: string) {
    const confirmed = window.confirm(
      "¿Seguro que deseas cancelar esta venta? El stock será restaurado."
    );

    if (!confirmed) return;

    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Ventas realizadas" value={String(completedSales.length)} />
        <SummaryCard title="Total vendido" value={`$${totalSold.toFixed(2)}`} />
        <SummaryCard title="Unidades vendidas" value={String(totalUnits)} />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Registrar venta
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Registra ventas de productos y descuenta stock automáticamente.
        </p>

        <form onSubmit={createSale} className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">
              Producto
            </span>

            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
            >
              <option value="">Seleccionar producto</option>

              {products
                .filter((product) => product.is_active)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · ${Number(product.price || 0).toFixed(2)} ·
                    Stock: {product.stock}
                  </option>
                ))}
            </select>
          </label>

          <Input
            label="Cantidad"
            type="number"
            value={quantity}
            onChange={setQuantity}
            placeholder="1"
          />

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">
              Método de pago
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

          <Input
            label="Referencia"
            value={referenceCode}
            onChange={setReferenceCode}
            placeholder="Opcional"
          />

          <Input
            label="Fecha de venta"
            type="date"
            value={saleDate}
            onChange={setSaleDate}
          />

          <Input
            label="Notas"
            value={notes}
            onChange={setNotes}
            placeholder="Opcional"
          />

          {selectedProduct && (
            <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600 md:col-span-3">
              Producto:{" "}
              <span className="font-bold text-neutral-900">
                {selectedProduct.name}
              </span>{" "}
              · Precio:{" "}
              <span className="font-bold text-neutral-900">
                ${selectedPrice.toFixed(2)}
              </span>{" "}
              · Stock disponible:{" "}
              <span className="font-bold text-neutral-900">
                {selectedStock}
              </span>{" "}
              · Total:{" "}
              <span className="font-bold text-neutral-900">
                ${Number(total || 0).toFixed(2)}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || products.length === 0}
            className="rounded-xl bg-neutral-950 px-5 py-3 font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-3"
          >
            {loading ? "Guardando..." : "Registrar venta"}
          </button>
        </form>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("correctamente") ||
            message.toLowerCase().includes("registrada")
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Historial de ventas
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Ventas registradas en el gimnasio.
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
            Total: {sales.length}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {sales.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Todavía no hay ventas registradas.
            </div>
          ) : (
            sales.map((sale) => (
              <div key={sale.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-neutral-950">
                        {sale.product_name || "Producto"}
                      </h3>

                      <StatusBadge status={sale.status} />
                    </div>

                    <p className="mt-1 text-sm text-neutral-500">
                      {sale.category || "Sin categoría"} · Cantidad:{" "}
                      {sale.quantity || 0} · Precio: $
                      {Number(sale.unit_price || 0).toFixed(2)}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      {formatPaymentMethod(sale.payment_method)} ·{" "}
                      {formatDate(sale.sale_date)}
                      {sale.reference_code
                        ? ` · Ref: ${sale.reference_code}`
                        : ""}
                    </p>

                    {sale.notes && (
                      <p className="mt-1 text-sm text-neutral-500">
                        Nota: {sale.notes}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-neutral-400">
                      Registrado por: {sale.created_by_name || "Usuario"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-black text-neutral-900">
                      ${Number(sale.total || 0).toFixed(2)}
                    </span>

                    {canCancel && sale.status === "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => cancelSale(sale.id)}
                        disabled={loading}
                        className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isCompleted = status === "COMPLETED";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        isCompleted
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {isCompleted ? "COMPLETADA" : "CANCELADA"}
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

function formatPaymentMethod(method: string) {
  const labels: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    OTHER: "Otro",
  };

  return labels[method] || method;
}