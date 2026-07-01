"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  image_url?: string | null;
  price: string | number;
  stock: number;
  stock_entry_date?: string | null;
  is_active: boolean;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export default function InventoryManager({
  products: rawProducts,
}: {
  products?: Product[];
}) {
  const products = Array.isArray(rawProducts) ? rawProducts : [];

  const totalStock = useMemo(() => {
    return products.reduce(
      (sum, product) => sum + Number(product.stock || 0),
      0
    );
  }, [products]);

  const productsWithStock = products.filter(
    (product) => Number(product.stock || 0) > 0
  );

  const productsWithoutStock = products.filter(
    (product) => Number(product.stock || 0) === 0
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Productos" value={String(products.length)} />
        <SummaryCard title="Unidades en stock" value={String(totalStock)} />
        <SummaryCard
          title="Sin stock"
          value={String(productsWithoutStock.length)}
        />
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Control de inventario
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Edita nombre, imagen, precio por unidad, stock y fecha de ingreso.
        </p>

        <div className="mt-6 space-y-4">
          {products.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Primero registra productos en el módulo Productos.
            </div>
          ) : (
            products.map((product) => (
              <InventoryProductCard key={product.id} product={product} />
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Resumen rápido</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-neutral-50 p-5">
            <p className="text-sm text-neutral-500">Con stock disponible</p>

            <p className="mt-2 text-3xl font-black text-neutral-950">
              {productsWithStock.length}
            </p>
          </div>

          <div className="rounded-2xl bg-neutral-50 p-5">
            <p className="text-sm text-neutral-500">Sin stock</p>

            <p className="mt-2 text-3xl font-black text-neutral-950">
              {productsWithoutStock.length}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function InventoryProductCard({ product }: { product: Product }) {
  const router = useRouter();

  const [name, setName] = useState(product.name || "");
  const [imageUrl, setImageUrl] = useState(product.image_url || "");
  const [price, setPrice] = useState(String(Number(product.price || 0)));
  const [stock, setStock] = useState(String(product.stock || 0));
  const [stockEntryDate, setStockEntryDate] = useState(
    product.stock_entry_date ? String(product.stock_entry_date).slice(0, 10) : ""
  );

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);

      return {
        ok: false,
        message:
          "La API no respondió correctamente. Revisa app/api/gym/inventory/product/route.ts",
      };
    }
  }

  async function saveInventory() {
    if (!name.trim()) {
      setMessage("El nombre del producto es obligatorio");
      return;
    }

    if (Number(price || 0) < 0) {
      setMessage("El precio no puede ser negativo");
      return;
    }

    if (Number(stock || 0) < 0) {
      setMessage("El stock no puede ser negativo");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/inventory/product", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          name: name.trim(),
          imageUrl: imageUrl.trim(),
          price: Number(price || 0),
          stock: Number(stock || 0),
          stockEntryDate,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al actualizar producto");
        return;
      }

      setMessage(data.message || "Producto actualizado correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error actualizando producto:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="grid gap-5 xl:grid-cols-[120px_1.2fr_1.3fr_150px_150px_180px_120px] xl:items-end">
        <div>
          <ProductImage imageUrl={imageUrl} name={name || "Producto"} />
        </div>

        <Input label="Nombre" value={name} onChange={setName} />

        <Input
          label="Imagen URL"
          value={imageUrl}
          onChange={setImageUrl}
          placeholder="https://..."
        />

        <Input
          label="Precio por unidad"
          type="number"
          step="0.01"
          value={price}
          onChange={setPrice}
        />

        <Input label="Stock" type="number" value={stock} onChange={setStock} />

        <Input
          label="Fecha de ingreso"
          type="date"
          value={stockEntryDate}
          onChange={setStockEntryDate}
        />

        <button
          type="button"
          onClick={saveInventory}
          disabled={loading}
          className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-500">
        <span className="rounded-full bg-neutral-100 px-3 py-1">
          Estado: {product.is_active ? "Activo" : "Inactivo"}
        </span>

        <span className="rounded-full bg-neutral-100 px-3 py-1">
          Stock actual: {stock || 0}
        </span>

        <span className="rounded-full bg-neutral-100 px-3 py-1">
          Precio: ${Number(price || 0).toFixed(2)}
        </span>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("correctamente")
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
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
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-neutral-100 text-center text-xs font-bold text-neutral-400">
        Sin imagen
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className="h-24 w-24 rounded-2xl object-cover"
    />
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
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">
        {label}
      </span>

      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
      />
    </label>
  );
}