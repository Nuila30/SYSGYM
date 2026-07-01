"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Gym = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  system_plan_id?: string | null;
  plan_name?: string | null;
  monthly_fee?: string | number | null;
  access_days?: number | null;
  end_date?: string | null;
  subscription_status?: string | null;
  admin_full_name?: string | null;
  admin_username?: string | null;
  admin_email?: string | null;
};

type SystemPlan = {
  id: string;
  name: string;
  code: string;
  monthly_fee: string | number;
  access_days: number;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export default function GymsManager({
  gyms: rawGyms,
  plans: rawPlans,
}: {
  gyms?: Gym[];
  plans?: SystemPlan[];
}) {
  const router = useRouter();

  const gyms = Array.isArray(rawGyms) ? rawGyms : [];
  const plans = Array.isArray(rawPlans) ? rawPlans : [];

  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editData, setEditData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    systemPlanId: "",
    adminFullName: "",
    adminUsername: "",
    adminEmail: "",
  });

  const selectedEditPlan = plans.find(
    (plan) => plan.id === editData.systemPlanId
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
          "La API no respondió correctamente. Revisa app/api/super-admin/gyms/route.ts",
      };
    }
  }

  function findMatchingPlan(gym: Gym) {
    if (gym.system_plan_id) {
      const byId = plans.find((plan) => plan.id === gym.system_plan_id);

      if (byId) return byId.id;
    }

    const byName = plans.find(
      (plan) =>
        plan.name.trim().toLowerCase() ===
        String(gym.plan_name || "").trim().toLowerCase()
    );

    return byName?.id || plans[0]?.id || "";
  }

  function startEdit(gym: Gym) {
    setMessage("");
    setEditingId(gym.id);

    setEditData({
      name: gym.name || "",
      phone: gym.phone || "",
      email: gym.email || "",
      address: gym.address || "",
      systemPlanId: findMatchingPlan(gym),
      adminFullName: gym.admin_full_name || "",
      adminUsername: gym.admin_username || "",
      adminEmail: gym.admin_email || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function updateGym(gymId: string) {
    const selectedPlan = plans.find((plan) => plan.id === editData.systemPlanId);

    if (!selectedPlan) {
      setMessage("Selecciona un plan válido");
      return;
    }

    setLoadingId(gymId);
    setMessage("");

    try {
      const res = await fetch("/api/super-admin/gyms", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gymId,
          name: editData.name,
          phone: editData.phone,
          email: editData.email,
          address: editData.address,

          systemPlanId: selectedPlan.id,
          planName: selectedPlan.name,
          monthlyFee: Number(selectedPlan.monthly_fee || 0),
          accessDays: Number(selectedPlan.access_days || 30),

          adminFullName: editData.adminFullName,
          adminUsername: editData.adminUsername,
          adminEmail: editData.adminEmail,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al editar gimnasio");
        return;
      }

      setMessage(data.message || "Gimnasio actualizado correctamente");
      setEditingId(null);
      router.refresh();
    } catch (error) {
      console.error("Error editando gimnasio:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingId(null);
    }
  }

  async function deleteGym(gymId: string) {
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este gimnasio? También se eliminarán sus usuarios relacionados."
    );

    if (!confirmed) return;

    setLoadingId(gymId);
    setMessage("");

    try {
      const res = await fetch(
        `/api/super-admin/gyms?gymId=${encodeURIComponent(gymId)}`,
        {
          method: "DELETE",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al eliminar gimnasio");
        return;
      }

      setMessage(data.message || "Gimnasio eliminado correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error eliminando gimnasio:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingId(null);
    }
  }

  async function changeStatus(gymId: string, nextStatus: "ACTIVE" | "SUSPENDED") {
    setLoadingId(gymId);
    setMessage("");

    const selectedGym = gyms.find((gym) => gym.id === gymId);
    const accessDays = Number(selectedGym?.access_days || 30);

    try {
      const res = await fetch("/api/super-admin/gyms/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gymId,
          status: nextStatus,
          accessDays,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al cambiar estado");
        return;
      }

      setMessage(data.message || "Estado actualizado correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error cambiando estado:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Gimnasios registrados
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Edita, reasigna planes, activa, suspende o elimina gimnasios.
          </p>
        </div>

        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
          Total: {gyms.length}
        </span>
      </div>

      {message && (
        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("correctamente") ||
            message.toLowerCase().includes("activado") ||
            message.toLowerCase().includes("suspendido")
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {gyms.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
            Todavía no hay gimnasios registrados.
          </div>
        ) : (
          gyms.map((gym) => {
            const isEditing = editingId === gym.id;
            const isActive = gym.status === "ACTIVE";
            const accessDays = Number(gym.access_days || 30);

            return (
              <div key={gym.id} className="rounded-2xl border p-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        label="Nombre del gimnasio"
                        value={editData.name}
                        onChange={(value) =>
                          setEditData((current) => ({
                            ...current,
                            name: value,
                          }))
                        }
                      />

                      <Input
                        label="Teléfono"
                        value={editData.phone}
                        onChange={(value) =>
                          setEditData((current) => ({
                            ...current,
                            phone: value,
                          }))
                        }
                      />

                      <Input
                        label="Correo"
                        value={editData.email}
                        onChange={(value) =>
                          setEditData((current) => ({
                            ...current,
                            email: value,
                          }))
                        }
                      />

                      <Input
                        label="Dirección"
                        value={editData.address}
                        onChange={(value) =>
                          setEditData((current) => ({
                            ...current,
                            address: value,
                          }))
                        }
                      />

                      <label className="block md:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-neutral-700">
                          Reasignar plan
                        </span>

                        <select
                          value={editData.systemPlanId}
                          onChange={(e) =>
                            setEditData((current) => ({
                              ...current,
                              systemPlanId: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
                        >
                          {plans.length === 0 ? (
                            <option value="">No hay planes disponibles</option>
                          ) : (
                            plans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name} - $
                                {Number(plan.monthly_fee || 0).toFixed(2)} -{" "}
                                {plan.access_days || 30} días
                              </option>
                            ))
                          )}
                        </select>
                      </label>

                      <ReadOnlyBox
                        label="Mensualidad del plan"
                        value={`$${Number(
                          selectedEditPlan?.monthly_fee || 0
                        ).toFixed(2)}`}
                      />

                      <ReadOnlyBox
                        label="Días del plan"
                        value={`${Number(
                          selectedEditPlan?.access_days || 30
                        )} días`}
                      />

                      <Input
                        label="Nombre administrador"
                        value={editData.adminFullName}
                        onChange={(value) =>
                          setEditData((current) => ({
                            ...current,
                            adminFullName: value,
                          }))
                        }
                      />

                      <Input
                        label="Usuario administrador"
                        value={editData.adminUsername}
                        onChange={(value) =>
                          setEditData((current) => ({
                            ...current,
                            adminUsername: value,
                          }))
                        }
                      />

                      <Input
                        label="Correo administrador"
                        value={editData.adminEmail}
                        onChange={(value) =>
                          setEditData((current) => ({
                            ...current,
                            adminEmail: value,
                          }))
                        }
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateGym(gym.id)}
                        disabled={loadingId === gym.id}
                        className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingId === gym.id
                          ? "Guardando..."
                          : "Guardar cambios"}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={loadingId === gym.id}
                        className="rounded-xl border px-5 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-black text-neutral-950">
                          {gym.name}
                        </h3>

                        <p className="mt-1 text-sm text-neutral-500">
                          {gym.email} · {gym.phone}
                        </p>

                        <p className="text-sm text-neutral-500">
                          {gym.address}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={gym.status} />
                        <StatusBadge
                          status={gym.subscription_status || gym.status}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      <InfoBox
                        label="Plan"
                        value={gym.plan_name || "Sin plan"}
                      />

                      <InfoBox
                        label="Mensualidad"
                        value={`$${Number(gym.monthly_fee || 0).toFixed(2)}`}
                      />

                      <InfoBox
                        label="Días"
                        value={`${accessDays} días`}
                      />

                      <InfoBox
                        label="Vence"
                        value={
                          gym.end_date ? formatDate(gym.end_date) : "Sin fecha"
                        }
                      />
                    </div>

                    <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                        <div>
                          <p className="text-xs text-neutral-500">
                            Días de acceso al activar
                          </p>

                          <p className="mt-1 text-lg font-black text-neutral-950">
                            {accessDays} días
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            changeStatus(
                              gym.id,
                              isActive ? "SUSPENDED" : "ACTIVE"
                            )
                          }
                          disabled={loadingId === gym.id}
                          className={`rounded-lg px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                            isActive
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {loadingId === gym.id
                            ? "Procesando..."
                            : isActive
                            ? "Suspender"
                            : "Activar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => startEdit(gym)}
                          disabled={loadingId === gym.id}
                          className="rounded-lg border px-5 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteGym(gym.id)}
                          disabled={loadingId === gym.id}
                          className="rounded-lg bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
      />
    </label>
  );
}

function ReadOnlyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-neutral-50 px-4 py-3">
      <p className="text-sm font-medium text-neutral-700">{label}</p>

      <p className="mt-1 text-lg font-black text-neutral-950">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="text-xs text-neutral-500">{label}</p>

      <p className="mt-1 text-sm font-black text-neutral-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${
        active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {active ? "ACTIVE" : "SUSPENDED"}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}