"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateGymForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    gymName: "",
    gymPhone: "",
    gymEmail: "",
    gymAddress: "",
    adminFullName: "",
    adminUsername: "",
    adminEmail: "",
    adminPassword: "",
    planName: "Plan Mensual",
    monthlyFee: "55",
    subscriptionDays: "30",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/super-admin/gyms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          monthlyFee: Number(form.monthlyFee),
          subscriptionDays: Number(form.subscriptionDays),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Error al registrar gimnasio");
        return;
      }

      setMessage("Gimnasio registrado correctamente");

      setForm({
        gymName: "",
        gymPhone: "",
        gymEmail: "",
        gymAddress: "",
        adminFullName: "",
        adminUsername: "",
        adminEmail: "",
        adminPassword: "",
        planName: "Plan Mensual",
        monthlyFee: "55",
        subscriptionDays: "30",
      });

      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-bold text-neutral-900">
        Registrar nuevo gimnasio
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        Crea el gimnasio cliente, su suscripción y su usuario administrador.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Input
          label="Nombre del gimnasio"
          value={form.gymName}
          onChange={(value) => updateField("gymName", value)}
          placeholder="Ej. Power Gym"
        />

        <Input
          label="Teléfono del gimnasio"
          value={form.gymPhone}
          onChange={(value) => updateField("gymPhone", value)}
          placeholder="7000-0000"
        />

        <Input
          label="Correo del gimnasio"
          type="email"
          value={form.gymEmail}
          onChange={(value) => updateField("gymEmail", value)}
          placeholder="contacto@gym.com"
        />

        <Input
          label="Dirección"
          value={form.gymAddress}
          onChange={(value) => updateField("gymAddress", value)}
          placeholder="San Salvador"
        />
      </div>

      <div className="my-6 border-t" />

      <h3 className="text-base font-bold text-neutral-900">
        Administrador del gimnasio
      </h3>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Input
          label="Nombre completo"
          value={form.adminFullName}
          onChange={(value) => updateField("adminFullName", value)}
          placeholder="Nombre del encargado"
        />

        <Input
          label="Usuario"
          value={form.adminUsername}
          onChange={(value) => updateField("adminUsername", value)}
          placeholder="powergym_admin"
        />

        <Input
          label="Correo"
          type="email"
          value={form.adminEmail}
          onChange={(value) => updateField("adminEmail", value)}
          placeholder="admin@gym.com"
        />

        <Input
          label="Contraseña"
          type="password"
          value={form.adminPassword}
          onChange={(value) => updateField("adminPassword", value)}
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div className="my-6 border-t" />

      <h3 className="text-base font-bold text-neutral-900">
        Suscripción del sistema
      </h3>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Input
          label="Plan"
          value={form.planName}
          onChange={(value) => updateField("planName", value)}
          placeholder="Plan Mensual"
        />

        <Input
          label="Mensualidad $"
          type="number"
          value={form.monthlyFee}
          onChange={(value) => updateField("monthlyFee", value)}
          placeholder="55"
        />

        <Input
          label="Días de acceso"
          type="number"
          value={form.subscriptionDays}
          onChange={(value) => updateField("subscriptionDays", value)}
          placeholder="30"
        />
      </div>

      {message && (
        <div className="mt-5 rounded-xl border bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {loading ? "Registrando..." : "Registrar gimnasio"}
      </button>
    </form>
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
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
      />
    </label>
  );
}