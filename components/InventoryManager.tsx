"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

const movementTypes = [
  { value: "IN", label: "Entrada de stock" },
  { value: "OUT", label: "Salida de stock" },
  { value: "ADJUSTMENT", label: "Ajuste manual" },
];

export default function InventoryManager({
  products: rawProducts,
  movements: rawMovements,
}: {
  products?: Product[];
  movements?: InventoryMovement[];
}) {
  const router = useRouter();

  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const movements = Array.isArray(rawMovements) ? rawMovements : [];

  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedProduct = products.find((product) => product.id === productId);

  const totalUnits = useMemo(() => {
    return products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(
      (product) => Number(product.stock || 0) <= Number(product.min_stock || 0)
    );
  }, [products]);

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);

      return {
        ok: false,
        message:
          "La API no respondió correctamente. Revisa app/api/gym/inventory/route.ts",
      };
    }
  }

  async function createMovement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!productId) {
      setMessage("Selecciona un producto");
      return;
    }

    if (movementType !== "ADJUSTMENT" && Number(quantity || 0) <= 0) {
      setMessage("La cantidad debe ser mayor a 0");
      return;
    }

    if (movementType === "ADJUSTMENT" && Number(quantity || 0) < 0) {
      setMessage("El nuevo stock no puede ser negativo");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          movementType,
          quantity: Number(quantity || 0),
          reason: reason.trim(),
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al registrar movimiento");
        return;
      }

      setProductId("");
      setMovementType("IN");
      setQuantity("");
      setReason("");

      setMessage(data.message || "Movimiento registrado correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error registrando movimiento:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Productos registrados" value={String(products.length)} />
        <SummaryCard title="Unidades en stock" value={String(totalUnits)} />
        <SummaryCard title="Bajo stock" value={String(lowStockProducts.length)} />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Registrar movimiento
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Controla entradas, salidas y ajustes de inventario.
        </p>

        <form onSubmit={createMovement} className="mt-6 grid gap-4 md:grid-cols-3">
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

              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · Stock: {product.stock}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">
              Tipo de movimiento
            </span>

            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
            >
              {movementTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <Input
            label={movementType === "ADJUSTMENT" ? "Nuevo stock" : "Cantidad"}
            type="number"
            value={quantity}
            onChange={setQuantity}
            placeholder={movementType === "ADJUSTMENT" ? "Ej. 20" : "Ej. 5"}
          />

          <div className="md:col-span-3">
            <Input
              label="Motivo o nota"
              value={reason}
              onChange={setReason}
              placeholder="Ej. Compra de producto, venta externa, corrección de conteo..."
            />
          </div>

          {selectedProduct && (
            <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600 md:col-span-3">
              Stock actual de{" "}
              <span className="font-bold text-neutral-900">
                {selectedProduct.name}
              </span>
              :{" "}
              <span className="font-bold text-neutral-900">
                {selectedProduct.stock}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || products.length === 0}
            className="rounded-xl bg-neutral-950 px-5 py-3 font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-3"
          >
            {loading ? "Guardando..." : "Registrar movimiento"}
          </button>
        </form>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("correctamente")
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
              Estado del inventario
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Stock actual de productos registrados.
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
            Total: {products.length}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {products.length === 0 ? (
            <EmptyMessage message="Todavía no hay productos registrados. Primero crea productos en el módulo Productos." />
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-neutral-950">
                      {product.name}
                    </h3>

                    <StatusBadge active={product.is_active} />

                    {Number(product.stock || 0) <= Number(product.min_stock || 0) && (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
                        Bajo stock
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-neutral-500">
                    {product.category || "Sin categoría"} · Precio: $
                    {Number(product.price || 0).toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StockPill label="Stock" value={String(product.stock)} />
                  <StockPill label="Mínimo" value={String(product.min_stock)} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Historial de movimientos
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Registro de entradas, salidas y ajustes realizados.
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
            Total: {movements.length}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {movements.length === 0 ? (
            <EmptyMessage message="Todavía no hay movimientos de inventario." />
          ) : (
            movements.map((movement) => (
              <div key={movement.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-neutral-950">
                        {movement.product_name}
                      </h3>

                      <MovementBadge type={movement.movement_type} />
                    </div>

                    <p className="mt-1 text-sm text-neutral-500">
                      Stock anterior: {movement.previous_stock} · Stock nuevo:{" "}
                      {movement.new_stock}
                    </p>

                    {movement.reason && (
                      <p className="mt-1 text-sm text-neutral-500">
                        Nota: {movement.reason}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-neutral-400">
                      {formatDateTime(movement.created_at)}
                      {movement.created_by_name
                        ? ` · ${movement.created_by_name}`
                        : ""}
                    </p>
                  </div>

                  <span className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-black text-neutral-900">
                    {movement.movement_type === "ADJUSTMENT"
                      ? `Nuevo: ${movement.quantity}`
                      : `${movement.movement_type === "IN" ? "+" : "-"}${
                          movement.quantity
                        }`}
                  </span>
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

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
      {message}
    </div>
  );
}

function StockPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-800">
      {label}: {value}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        active
          ? "bg-green-100 text-green-700"
          : "bg-neutral-200 text-neutral-600"
      }`}
    >
      {active ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

function MovementBadge({ type }: { type: string }) {
  const className =
    type === "IN"
      ? "bg-green-100 text-green-700"
      : type === "OUT"
      ? "bg-red-100 text-red-700"
      : "bg-blue-100 text-blue-700";

  const label =
    type === "IN" ? "ENTRADA" : type === "OUT" ? "SALIDA" : "AJUSTE";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}