"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Error al cambiar contraseña");
        return;
      }

      setMessage("Contraseña cambiada. Inicia sesión nuevamente.");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      console.error(error);
      setMessage("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-900">
          Cambiar contraseña
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Debes crear una contraseña propia para continuar usando el sistema.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Nueva contraseña"
            value={newPassword}
            onChange={setNewPassword}
          />

          <Input
            label="Confirmar contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {message && (
            <div className="rounded-xl border bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        {label}
      </span>

      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
      />
    </label>
  );
}