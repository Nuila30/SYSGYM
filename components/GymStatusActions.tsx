"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GymStatusActions({
  gymId,
  currentStatus,
}: {
  gymId: string;
  currentStatus: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [accessDays, setAccessDays] = useState("30");
  const [message, setMessage] = useState("");

  async function updateStatus(action: "ACTIVATE" | "SUSPEND") {
    const confirmMessage =
      action === "SUSPEND"
        ? "¿Seguro que deseas suspender este gimnasio?"
        : "¿Seguro que deseas activar este gimnasio?";

    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/super-admin/gyms/${gymId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          accessDays: Number(accessDays),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Error actualizando gimnasio");
        return;
      }

      setMessage(data.message || "Estado actualizado");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-neutral-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Días de acceso al activar
          </span>

          <input
            type="number"
            value={accessDays}
            onChange={(e) => setAccessDays(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
          />
        </label>

        {currentStatus === "ACTIVE" ? (
          <button
            type="button"
            onClick={() => updateStatus("SUSPEND")}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Procesando..." : "Suspender"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => updateStatus("ACTIVATE")}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Procesando..." : "Activar"}
          </button>
        )}
      </div>

      {message && (
        <p className="mt-3 text-sm text-neutral-600">
          {message}
        </p>
      )}
    </div>
  );
}