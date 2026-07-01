"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

export default function ProductsManager({
  products: rawProducts,
  canManage,
}: {
  products?: Product[];
  canManage: boolean;
}) {
  const router = useRouter();

  const products = Array.isArray(rawProducts) ? rawProducts : [];

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  function startEdit(product: Product) {
    setMessage("");
    setEditingId(product.id);
    setEditName(product.name);
    setEditImageUrl(product.image_url || "");
    setEditPrice(String(Number(product.price || 0)));
    setEditIsActive(Boolean(product.is_active));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditImageUrl("");
    setEditPrice("");
    setEditIsActive(true);
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
          "La API no respondió correctamente. Revisa app/api/gym/products/route.ts",
      };
    }
  }

  async function createProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) {
      setMessage("Ingresa el nombre del producto");
      return;
    }

    if (Number(price || 0) < 0) {
      setMessage("El precio no puede ser negativo");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          imageUrl: imageUrl.trim(),
          price: Number(price || 0),
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al crear producto");
        return;
      }

      setName("");
      setImageUrl("");
      setPrice("");
      setMessage(data.message || "Producto creado correctamente");

      router.refresh();
    } catch (error) {
      console.error("Error creando producto:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function updateProduct(productId: string) {
    if (!editName.trim()) {
      setMessage("Ingresa el nombre del producto");
      return;
    }

    if (Number(editPrice || 0) < 0) {
      setMessage("El precio no puede ser negativo");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/products?productId=${encodeURIComponent(productId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editName.trim(),
            imageUrl: editImageUrl.trim(),
            price: Number(editPrice || 0),
            isActive: editIsActive,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al actualizar producto");
        return;
      }

      setMessage(data.message || "Producto actualizado correctamente");
      cancelEdit();

      router.refresh();
    } catch (error) {
      console.error("Error actualizando producto:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct(productId: string) {
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este producto?"
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/products?productId=${encodeURIComponent(productId)}`,
        {
          method: "DELETE",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al eliminar producto");
        return;
      }

      setMessage(data.message || "Producto eliminado correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error eliminando producto:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">
            Productos
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Crea y edita únicamente la información básica del producto.
          </p>

          <form
            onSubmit={createProduct}
            className="mt-6 grid gap-4 md:grid-cols-3"
          >
            <Input
              label="Nombre"
              value={name}
              onChange={setName}
              placeholder="Ej. Agua"
            />

            <Input
              label="Imagen URL"
              value={imageUrl}
              onChange={setImageUrl}
              placeholder="https://..."
            />

            <Input
              label="Precio $"
              type="number"
              step="0.01"
              value={price}
              onChange={setPrice}
              placeholder="1.00"
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-neutral-950 px-5 py-3 font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-3"
            >
              {loading ? "Guardando..." : "Crear producto"}
            </button>
          </form>
        </section>
      )}

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

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Lista de productos
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Aquí solo se controla nombre, imagen y precio.
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
            Total: {products.length}
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {products.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500 lg:col-span-2">
              Todavía no hay productos registrados.
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className="rounded-2xl border p-4">
                {editingId === product.id ? (
                  <div className="space-y-4">
                    <Input
                      label="Nombre"
                      value={editName}
                      onChange={setEditName}
                    />

                    <Input
                      label="Imagen URL"
                      value={editImageUrl}
                      onChange={setEditImageUrl}
                    />

                    <Input
                      label="Precio $"
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={setEditPrice}
                    />

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-neutral-700">
                        Estado
                      </span>

                      <select
                        value={editIsActive ? "ACTIVE" : "INACTIVE"}
                        onChange={(e) =>
                          setEditIsActive(e.target.value === "ACTIVE")
                        }
                        className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
                      >
                        <option value="ACTIVE">Activo</option>
                        <option value="INACTIVE">Inactivo</option>
                      </select>
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateProduct(product.id)}
                        disabled={loading}
                        className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Guardar
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={loading}
                        className="rounded-xl border px-5 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <ProductImage imageUrl={product.image_url} name={product.name} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-neutral-950">
                          {product.name}
                        </h3>

                        <StatusBadge active={product.is_active} />
                      </div>

                      <p className="mt-2 text-2xl font-black text-neutral-950">
                        ${Number(product.price || 0).toFixed(2)}
                      </p>

                      <p className="mt-1 text-sm text-neutral-500">
                        Stock actual: {product.stock}
                      </p>

                      {canManage && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(product)}
                            disabled={loading}
                            className="rounded-lg border px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteProduct(product.id)}
                            disabled={loading}
                            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
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
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-xs font-bold text-neutral-400">
        Sin imagen
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className="h-24 w-24 shrink-0 rounded-2xl object-cover"
    />
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