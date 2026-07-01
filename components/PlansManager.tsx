"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SystemPlan = {
  id: string;
  name: string;
  code: string;
  monthly_fee: string | number;
  access_days: number;
  description: string | null;
  features: string[] | null;
  restrictions: string[] | null;
  max_employees: number | null;
  max_members: number | null;
  max_products: number | null;
  can_use_inventory: boolean;
  can_use_sales: boolean;
  can_use_attendance: boolean;
  can_use_reports: boolean;
  is_active: boolean;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

type PlanForm = {
  name: string;
  code: string;
  monthlyFee: string;
  accessDays: string;
  description: string;
  features: string;
  restrictions: string;
  maxEmployees: string;
  maxMembers: string;
  maxProducts: string;
  canUseInventory: boolean;
  canUseSales: boolean;
  canUseAttendance: boolean;
  canUseReports: boolean;
  isActive: boolean;
};

const emptyForm: PlanForm = {
  name: "",
  code: "",
  monthlyFee: "",
  accessDays: "",
  description: "",
  features: "",
  restrictions: "",
  maxEmployees: "",
  maxMembers: "",
  maxProducts: "",
  canUseInventory: false,
  canUseSales: false,
  canUseAttendance: false,
  canUseReports: false,
  isActive: true,
};

export default function PlansManager({
  plans: rawPlans,
}: {
  plans?: SystemPlan[];
}) {
  const router = useRouter();

  const plans = Array.isArray(rawPlans) ? rawPlans : [];

  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [editForm, setEditForm] = useState<PlanForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
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
          "La API no respondió correctamente. Revisa app/api/super-admin/plans/route.ts",
      };
    }
  }

  function updateForm<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateEditForm<K extends keyof PlanForm>(
    key: K,
    value: PlanForm[K]
  ) {
    setEditForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validatePlan(data: PlanForm) {
    if (!data.name.trim()) return "Ingresa el nombre del plan";
    if (!data.code.trim()) return "Ingresa el código del plan";
    if (Number(data.monthlyFee || 0) < 0) {
      return "El precio no puede ser negativo";
    }

    return "";
  }

  function toPayload(data: PlanForm) {
    return {
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      monthlyFee: Number(data.monthlyFee || 0),
      accessDays: Number(data.accessDays || 30),
      description: data.description.trim(),
      features: data.features,
      restrictions: data.restrictions,
      maxEmployees: data.maxEmployees ? Number(data.maxEmployees) : null,
      maxMembers: data.maxMembers ? Number(data.maxMembers) : null,
      maxProducts: data.maxProducts ? Number(data.maxProducts) : null,
      canUseInventory: data.canUseInventory,
      canUseSales: data.canUseSales,
      canUseAttendance: data.canUseAttendance,
      canUseReports: data.canUseReports,
      isActive: data.isActive,
    };
  }

  async function createPlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const error = validatePlan(form);

    if (error) {
      setMessage(error);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/super-admin/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toPayload(form)),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al crear plan");
        return;
      }

      setMessage(data.message || "Plan creado correctamente");
      setForm(emptyForm);
      router.refresh();
    } catch (error) {
      console.error("Error creando plan:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(plan: SystemPlan) {
    setMessage("");
    setEditingId(plan.id);

    setEditForm({
      name: plan.name || "",
      code: plan.code || "",
      monthlyFee: String(Number(plan.monthly_fee || 0)),
      accessDays: String(plan.access_days || 30),
      description: plan.description || "",
      features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
      restrictions: Array.isArray(plan.restrictions)
        ? plan.restrictions.join("\n")
        : "",
      maxEmployees:
        plan.max_employees === null || plan.max_employees === undefined
          ? ""
          : String(plan.max_employees),
      maxMembers:
        plan.max_members === null || plan.max_members === undefined
          ? ""
          : String(plan.max_members),
      maxProducts:
        plan.max_products === null || plan.max_products === undefined
          ? ""
          : String(plan.max_products),
      canUseInventory: Boolean(plan.can_use_inventory),
      canUseSales: Boolean(plan.can_use_sales),
      canUseAttendance: Boolean(plan.can_use_attendance),
      canUseReports: Boolean(plan.can_use_reports),
      isActive: Boolean(plan.is_active),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function updatePlan(planId: string) {
    const error = validatePlan(editForm);

    if (error) {
      setMessage(error);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/super-admin/plans?planId=${encodeURIComponent(planId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toPayload(editForm)),
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
      "¿Seguro que deseas eliminar este plan? Si ya está asignado a un gimnasio, no se podrá eliminar."
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/super-admin/plans?planId=${encodeURIComponent(planId)}`,
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
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Crear nuevo plan</h2>

        <p className="mt-1 text-sm text-neutral-500">
          Define precio, funciones incluidas, restricciones y módulos
          permitidos.
        </p>

        <form onSubmit={createPlan} className="mt-6 space-y-5">
          <Input
            label="Nombre del plan"
            value={form.name}
            onChange={(value) => updateForm("name", value)}
            placeholder="Plan Básico"
          />

          <Input
            label="Código"
            value={form.code}
            onChange={(value) => updateForm("code", value)}
            placeholder="BASIC"
          />

          <Input
            label="Mensualidad $"
            type="number"
            step="0.01"
            value={form.monthlyFee}
            onChange={(value) => updateForm("monthlyFee", value)}
            placeholder="35"
          />
          <Input
            label="Días de acceso"
            type="number"
            value={form.accessDays}
            onChange={(value) => updateForm("accessDays", value)}
            placeholder="30"
          />
          <Input
            label="Descripción"
            value={form.description}
            onChange={(value) => updateForm("description", value)}
            placeholder="Plan inicial para gimnasios pequeños"
          />

          <Textarea
            label="Funciones incluidas"
            value={form.features}
            onChange={(value) => updateForm("features", value)}
            placeholder={
              "Gestión de usuarios\nGestión de membresías\nPanel administrativo"
            }
          />

          <Textarea
            label="Restricciones"
            value={form.restrictions}
            onChange={(value) => updateForm("restrictions", value)}
            placeholder={"No incluye inventario\nNo incluye ventas"}
          />

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <Input
              label="Máximo empleados"
              type="number"
              value={form.maxEmployees}
              onChange={(value) => updateForm("maxEmployees", value)}
              placeholder="2"
            />

            <Input
              label="Máximo miembros"
              type="number"
              value={form.maxMembers}
              onChange={(value) => updateForm("maxMembers", value)}
              placeholder="100"
            />

            <Input
              label="Máximo productos"
              type="number"
              value={form.maxProducts}
              onChange={(value) => updateForm("maxProducts", value)}
              placeholder="0"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Checkbox
              label="Inventario"
              checked={form.canUseInventory}
              onChange={(value) => updateForm("canUseInventory", value)}
            />

            <Checkbox
              label="Ventas"
              checked={form.canUseSales}
              onChange={(value) => updateForm("canUseSales", value)}
            />

            <Checkbox
              label="Asistencia QR"
              checked={form.canUseAttendance}
              onChange={(value) => updateForm("canUseAttendance", value)}
            />

            <Checkbox
              label="Reportes"
              checked={form.canUseReports}
              onChange={(value) => updateForm("canUseReports", value)}
            />
          </div>

          {message && <MessageBox message={message} />}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Crear plan"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Planes registrados
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Edita, elimina o desactiva planes del SaaS.
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
            Total: {plans.length}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Todavía no hay planes registrados.
            </div>
          ) : (
            plans.map((plan) => {
              const isEditing = editingId === plan.id;

              return (
                <div key={plan.id} className="rounded-2xl border p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Input
                          label="Nombre"
                          value={editForm.name}
                          onChange={(value) => updateEditForm("name", value)}
                        />

                        <Input
                          label="Código"
                          value={editForm.code}
                          onChange={(value) => updateEditForm("code", value)}
                        />

                        <Input
                          label="Mensualidad $"
                          type="number"
                          step="0.01"
                          value={editForm.monthlyFee}
                          onChange={(value) =>
                            updateEditForm("monthlyFee", value)
                          }
                        />
                        <Input
                          label="Días de acceso"
                          type="number"
                          value={editForm.accessDays}
                          onChange={(value) =>
                            updateEditForm("accessDays", value)
                          }
                        />

                        <Input
                          label="Descripción"
                          value={editForm.description}
                          onChange={(value) =>
                            updateEditForm("description", value)
                          }
                        />
                      </div>

                      <Textarea
                        label="Funciones incluidas"
                        value={editForm.features}
                        onChange={(value) => updateEditForm("features", value)}
                      />

                      <Textarea
                        label="Restricciones"
                        value={editForm.restrictions}
                        onChange={(value) =>
                          updateEditForm("restrictions", value)
                        }
                      />

                      <div className="grid gap-4 md:grid-cols-3">
                        <Input
                          label="Máximo empleados"
                          type="number"
                          value={editForm.maxEmployees}
                          onChange={(value) =>
                            updateEditForm("maxEmployees", value)
                          }
                        />

                        <Input
                          label="Máximo miembros"
                          type="number"
                          value={editForm.maxMembers}
                          onChange={(value) =>
                            updateEditForm("maxMembers", value)
                          }
                        />

                        <Input
                          label="Máximo productos"
                          type="number"
                          value={editForm.maxProducts}
                          onChange={(value) =>
                            updateEditForm("maxProducts", value)
                          }
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <Checkbox
                          label="Activo"
                          checked={editForm.isActive}
                          onChange={(value) =>
                            updateEditForm("isActive", value)
                          }
                        />

                        <Checkbox
                          label="Inventario"
                          checked={editForm.canUseInventory}
                          onChange={(value) =>
                            updateEditForm("canUseInventory", value)
                          }
                        />

                        <Checkbox
                          label="Ventas"
                          checked={editForm.canUseSales}
                          onChange={(value) =>
                            updateEditForm("canUseSales", value)
                          }
                        />

                        <Checkbox
                          label="Asistencia QR"
                          checked={editForm.canUseAttendance}
                          onChange={(value) =>
                            updateEditForm("canUseAttendance", value)
                          }
                        />

                        <Checkbox
                          label="Reportes"
                          checked={editForm.canUseReports}
                          onChange={(value) =>
                            updateEditForm("canUseReports", value)
                          }
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updatePlan(plan.id)}
                          disabled={loading}
                          className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Guardar cambios
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
                    <>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-neutral-950">
                              {plan.name}
                            </h3>

                            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
                              {plan.code}
                            </span>

                            <StatusBadge active={plan.is_active} />
                          </div>

                          <p className="mt-2 text-3xl font-black text-neutral-950">
                            ${Number(plan.monthly_fee || 0).toFixed(2)}
                          </p>

                          {plan.description && (
                            <p className="mt-1 text-sm text-neutral-500">
                              {plan.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
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

                      <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <InfoBox
                          label="Días de acceso"
                          value={`${plan.access_days || 30} días`}
                        />

                        <InfoBox
                          label="Empleados"
                          value={
                            plan.max_employees === null
                              ? "Sin límite"
                              : String(plan.max_employees)
                          }
                        />

                        <InfoBox
                          label="Miembros"
                          value={
                            plan.max_members === null
                              ? "Sin límite"
                              : String(plan.max_members)
                          }
                        />

                        <InfoBox
                          label="Productos"
                          value={
                            plan.max_products === null
                              ? "Sin límite"
                              : String(plan.max_products)
                          }
                        />
                      </div>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <ListBox title="Incluye" items={plan.features || []} />

                        <ListBox
                          title="Restricciones"
                          items={plan.restrictions || []}
                        />
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <ModuleBadge
                          enabled={plan.can_use_inventory}
                          label="Inventario"
                        />

                        <ModuleBadge
                          enabled={plan.can_use_sales}
                          label="Ventas"
                        />

                        <ModuleBadge
                          enabled={plan.can_use_attendance}
                          label="Asistencia QR"
                        />

                        <ModuleBadge
                          enabled={plan.can_use_reports}
                          label="Reportes"
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
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

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
      />
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-neutral-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />

      {label}
    </label>
  );
}

function MessageBox({ message }: { message: string }) {
  const success =
    message.toLowerCase().includes("correctamente") ||
    message.toLowerCase().includes("creado") ||
    message.toLowerCase().includes("actualizado") ||
    message.toLowerCase().includes("eliminado");

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        success
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
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

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="text-xs text-neutral-500">{label}</p>

      <p className="mt-1 text-sm font-black text-neutral-950">{value}</p>
    </div>
  );
}

function ListBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="text-xs font-bold uppercase text-neutral-500">{title}</p>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Sin datos</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModuleBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        enabled
          ? "bg-green-100 text-green-700"
          : "bg-neutral-200 text-neutral-600"
      }`}
    >
      {enabled ? label : `${label} no incluido`}
    </span>
  );
}
