"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MembershipPlan = {
  id: string;
  name: string;
  duration_days: number;
  price: string | number;
  schedule?: string | null;
  is_active: boolean;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export default function MembershipPlansManager({
  plans: rawPlans,
}: {
  plans?: MembershipPlan[];
}) {
  const router = useRouter();

  const plans = Array.isArray(rawPlans) ? rawPlans : [];

  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [price, setPrice] = useState("");
  const [schedule, setSchedule] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDurationDays, setEditDurationDays] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  function startEdit(plan: MembershipPlan) {
    setMessage("");
    setEditingId(plan.id);
    setEditName(plan.name);
    setEditDurationDays(String(plan.duration_days));
    setEditPrice(String(Number(plan.price || 0)));
    setEditSchedule(
      plan.schedule || "Consultar horarios disponibles en el local"
    );
    setEditIsActive(Boolean(plan.is_active));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDurationDays("");
    setEditPrice("");
    setEditSchedule("");
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
          "La API no respondió correctamente. Revisa app/api/gym/membership-plans/route.ts",
      };
    }
  }

  async function createPlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) {
      setMessage("Ingresa el nombre del plan");
      return;
    }

    if (Number(durationDays) <= 0) {
      setMessage("La duración debe ser mayor a 0 días");
      return;
    }

    if (Number(price || 0) < 0) {
      setMessage("El precio no puede ser negativo");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/membership-plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          durationDays: Number(durationDays),
          price: Number(price || 0),
          schedule:
            schedule.trim() || "Consultar horarios disponibles en el local",
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al crear plan");
        return;
      }

      setName("");
      setDurationDays("");
      setPrice("");
      setSchedule("");
      setMessage(data.message || "Plan creado correctamente");

      router.refresh();
    } catch (error) {
      console.error("Error creando plan:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function updatePlan(planId: string) {
    if (!editName.trim()) {
      setMessage("Ingresa el nombre del plan");
      return;
    }

    if (Number(editDurationDays) <= 0) {
      setMessage("La duración debe ser mayor a 0 días");
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
        `/api/gym/membership-plans?planId=${encodeURIComponent(planId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editName.trim(),
            durationDays: Number(editDurationDays),
            price: Number(editPrice || 0),
            schedule:
              editSchedule.trim() ||
              "Consultar horarios disponibles en el local",
            isActive: editIsActive,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al actualizar plan");
        return;
      }

      setMessage(data.message || "Plan actualizado correctamente");
      cancelEdit();

      router.refresh();
    } catch (error) {
      console.error("Error actualizando plan:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function deletePlan(planId: string) {
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este plan de membresía?"
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/membership-plans?planId=${encodeURIComponent(planId)}`,
        {
          method: "DELETE",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al eliminar plan");
        return;
      }

      setMessage(data.message || "Plan eliminado correctamente");

      router.refresh();
    } catch (error) {
      console.error("Error eliminando plan:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-neutral-900">
        Planes de membresía
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        Crea, edita o elimina los planes disponibles para el gimnasio.
      </p>

      <form onSubmit={createPlan} className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-neutral-700">
            Nombre
          </span>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Mensual"
            className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-neutral-700">
            Duración en días
          </span>

          <input
            type="number"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            placeholder="30"
            className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-neutral-700">
            Precio $
          </span>

          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25"
            className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
          />
        </label>

        <label className="block md:col-span-3">
          <span className="mb-2 block text-sm font-medium text-neutral-700">
            Horarios
          </span>

          <input
            type="text"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="Ej. Lunes a viernes de 6:00 AM a 8:00 PM"
            className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-neutral-950 px-5 py-3 font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-3"
        >
          {loading ? "Guardando..." : "Crear plan"}
        </button>
      </form>

      {message && (
        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("correctamente")
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
            Todavía no hay planes registrados.
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border p-4">
              {editingId === plan.id ? (
                <div className="grid gap-4 md:grid-cols-4">
                  <label>
                    <span className="mb-2 block text-sm text-neutral-700">
                      Nombre
                    </span>

                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm text-neutral-700">
                      Días
                    </span>

                    <input
                      type="number"
                      value={editDurationDays}
                      onChange={(e) => setEditDurationDays(e.target.value)}
                      className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm text-neutral-700">
                      Precio
                    </span>

                    <input
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm text-neutral-700">
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

                  <label className="md:col-span-4">
                    <span className="mb-2 block text-sm text-neutral-700">
                      Horarios
                    </span>

                    <input
                      type="text"
                      value={editSchedule}
                      onChange={(e) => setEditSchedule(e.target.value)}
                      className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
                    />
                  </label>

                  <div className="flex gap-2 md:col-span-4">
                    <button
                      type="button"
                      onClick={() => updatePlan(plan.id)}
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-950">{plan.name}</h3>

                    <p className="mt-1 text-sm text-neutral-500">
                      {plan.duration_days} días · $
                      {Number(plan.price || 0).toFixed(2)}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      Horarios:{" "}
                      {plan.schedule ||
                        "Consultar horarios disponibles en el local"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        plan.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {plan.is_active ? "ACTIVO" : "INACTIVO"}
                    </span>

                    <button
                      type="button"
                      onClick={() => startEdit(plan)}
                      disabled={loading}
                      className="rounded-lg border px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => deletePlan(plan.id)}
                      disabled={loading}
                      className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}