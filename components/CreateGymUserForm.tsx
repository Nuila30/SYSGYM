"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateGymUserForm({
  currentRole,
}: {
  currentRole: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "MEMBER",
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
      const res = await fetch("/api/gym/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Error al registrar usuario");
        return;
      }

      setMessage(data.message || "Usuario registrado correctamente");

      setForm({
        fullName: "",
        email: "",
        phone: "",
        role: "MEMBER",
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
        Registrar usuario
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        El usuario y la contraseña temporal se generarán automáticamente.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Input
          label="Nombre completo"
          value={form.fullName}
          onChange={(value) => updateField("fullName", value)}
          placeholder="Ej. Juan Pérez"
        />

        <Input
          label="Teléfono"
          value={form.phone}
          onChange={(value) => updateField("phone", value)}
          placeholder="8990-8765"
        />

        <Input
          label="Correo"
          type="email"
          value={form.email}
          onChange={(value) => updateField("email", value)}
          placeholder="usuario@gym.com"
        />

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">
            Rol
          </span>

          <select
            value={form.role}
            onChange={(e) => updateField("role", e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-900"
          >
            <option value="MEMBER">Miembro</option>

            {currentRole === "GYM_ADMIN" && (
              <option value="EMPLOYEE">Empleado</option>
            )}
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-xl bg-neutral-50 p-4">
        <p className="text-sm font-semibold text-neutral-800">
          Generación automática
        </p>

        <p className="mt-1 text-sm text-neutral-500">
          Ejemplo: Juan Perez + 8990-8765 genera un usuario como Jua90Per89.
          La contraseña temporal vence en 8 horas y se enviará al correo.
        </p>
      </div>

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

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {loading ? "Registrando..." : "Registrar usuario"}
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
        autoComplete="off"
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
      />
    </label>
  );
}