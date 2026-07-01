"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SystemPlan = {
  id: string;
  name: string;
  code: string;
  monthly_fee: string | number;
  access_days: number;
  description?: string | null;
  features?: string[] | null;
  restrictions?: string[] | null;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  emailSent?: boolean;
  emailError?: string | null;
};

export default function CreateGymForm({
  plans: rawPlans,
}: {
  plans?: SystemPlan[];
}) {
  const router = useRouter();

  const plans = Array.isArray(rawPlans) ? rawPlans : [];

  const [gymName, setGymName] = useState("");
  const [gymPhone, setGymPhone] = useState("");
  const [gymEmail, setGymEmail] = useState("");
  const [gymAddress, setGymAddress] = useState("");

  const [systemPlanId, setSystemPlanId] = useState(plans[0]?.id || "");

  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPlan = plans.find((plan) => plan.id === systemPlanId);
  const selectedAccessDays = Number(selectedPlan?.access_days || 30);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!gymName || !gymPhone || !gymEmail || !gymAddress) {
      setMessage("Completa los datos del gimnasio");
      return;
    }

    if (!systemPlanId) {
      setMessage("Selecciona un plan para el gimnasio");
      return;
    }

    if (!adminFullName || !adminEmail || !adminPhone) {
      setMessage("Completa los datos del administrador");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/super-admin/gyms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: gymName,
          phone: gymPhone,
          email: gymEmail,
          address: gymAddress,
          systemPlanId,
          adminFullName,
          adminEmail,
          adminPhone,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al registrar gimnasio");
        return;
      }

      setMessage(data.message || "Gimnasio registrado y credenciales enviadas correctamente");

      setGymName("");
      setGymPhone("");
      setGymEmail("");
      setGymAddress("");
      setAdminFullName("");
      setAdminEmail("");
      setAdminPhone("");

      router.refresh();
    } catch (error) {
      console.error("Error registrando gimnasio:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-neutral-900">
        Registrar nuevo gimnasio
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        Crea el gimnasio, asigna un plan y genera automáticamente el usuario
        administrador.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <h3 className="mb-4 font-bold text-neutral-900">
            Datos del gimnasio
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Nombre del gimnasio"
              value={gymName}
              onChange={setGymName}
              placeholder="Ej. Power Gym"
            />

            <Input
              label="Teléfono del gimnasio"
              value={gymPhone}
              onChange={setGymPhone}
              placeholder="7000-0000"
            />

            <Input
              label="Correo del gimnasio"
              type="email"
              value={gymEmail}
              onChange={setGymEmail}
              placeholder="contacto@gym.com"
            />

            <Input
              label="Dirección"
              value={gymAddress}
              onChange={setGymAddress}
              placeholder="San Salvador"
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="mb-4 font-bold text-neutral-900">
            Plan del sistema
          </h3>

          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">
                Plan
              </span>

              <select
                value={systemPlanId}
                onChange={(e) => setSystemPlanId(e.target.value)}
                className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
              >
                {plans.length === 0 ? (
                  <option value="">No hay planes creados</option>
                ) : (
                  plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ${Number(plan.monthly_fee || 0).toFixed(2)}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">
                Días de acceso
              </span>

              <div className="rounded-xl border bg-neutral-50 px-4 py-3 font-bold text-neutral-900">
                {selectedAccessDays} días
              </div>
            </div>
          </div>

          {selectedPlan && (
            <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-neutral-900">
                    {selectedPlan.name} · $
                    {Number(selectedPlan.monthly_fee || 0).toFixed(2)}
                  </p>

                  {selectedPlan.description && (
                    <p className="mt-1 text-sm text-neutral-500">
                      {selectedPlan.description}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase text-neutral-500">
                    Días incluidos
                  </p>

                  <p className="mt-1 text-lg font-black text-neutral-950">
                    {selectedAccessDays} días
                  </p>
                </div>
              </div>

              {selectedPlan.features && selectedPlan.features.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-neutral-500">
                    Incluye
                  </p>

                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {selectedPlan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedPlan.restrictions &&
                selectedPlan.restrictions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase text-neutral-500">
                      Restricciones
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                      {selectedPlan.restrictions.map((restriction) => (
                        <li key={restriction}>{restriction}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="border-t pt-6">
          <h3 className="mb-4 font-bold text-neutral-900">
            Administrador del gimnasio
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Nombre completo"
              value={adminFullName}
              onChange={setAdminFullName}
              placeholder="Nombre del encargado"
            />

            <Input
              label="Teléfono"
              value={adminPhone}
              onChange={setAdminPhone}
              placeholder="7000-0000"
            />

            <Input
              label="Correo"
              type="email"
              value={adminEmail}
              onChange={setAdminEmail}
              placeholder="admin@gym.com"
            />

            <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
              El usuario y la contraseña se generarán automáticamente usando el
              nombre completo y teléfono del administrador. Las credenciales se
              enviarán únicamente por correo.
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.toLowerCase().includes("correctamente") ||
              message.toLowerCase().includes("registrado") ||
              message.toLowerCase().includes("enviadas")
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || plans.length === 0}
          className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Registrando..." : "Registrar gimnasio"}
        </button>
      </form>
    </section>
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