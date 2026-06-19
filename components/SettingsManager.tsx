"use client";

import { useEffect, useState } from "react";

type UserAccount = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super administrador",
  GYM_ADMIN: "Administrador del gimnasio",
  EMPLOYEE: "Empleado",
  MEMBER: "Miembro",
};

export default function SettingsManager({ user }: { user: UserAccount }) {
  const [fullName, setFullName] = useState(user.full_name || "");
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [theme, setTheme] = useState("system");

  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [preferenceMessage, setPreferenceMessage] = useState("");

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("gym_theme") || "system";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  function applyTheme(value: string) {
    localStorage.setItem("gym_theme", value);

    const root = document.documentElement;

    if (value === "dark") {
      root.classList.add("dark");
      return;
    }

    if (value === "light") {
      root.classList.remove("dark");
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);

      return {
        ok: false,
        message: "La API no respondió correctamente.",
      };
    }
  }

  async function updateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!fullName.trim()) {
      setProfileMessage("El nombre es obligatorio");
      return;
    }

    if (!email.trim()) {
      setProfileMessage("El correo es obligatorio");
      return;
    }

    setLoadingProfile(true);
    setProfileMessage("");

    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setProfileMessage(data.message || data.error || "Error al actualizar");
        return;
      }

      setProfileMessage(data.message || "Perfil actualizado correctamente");
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      setProfileMessage("Error de conexión con el servidor");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function updatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage("Completa todos los campos");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Las contraseñas no coinciden");
      return;
    }

    setLoadingPassword(true);
    setPasswordMessage("");

    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setPasswordMessage(
          data.message || data.error || "Error al cambiar contraseña"
        );
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(data.message || "Contraseña actualizada correctamente");
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      setPasswordMessage("Error de conexión con el servidor");
    } finally {
      setLoadingPassword(false);
    }
  }

  function updateTheme(value: string) {
    setTheme(value);
    applyTheme(value);
    setPreferenceMessage("Preferencia guardada en este dispositivo");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Información de la cuenta
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <InfoCard label="Nombre" value={user.full_name} />
          <InfoCard label="Usuario" value={user.username} />
          <InfoCard label="Correo" value={user.email} />
          <InfoCard label="Teléfono" value={user.phone || "Sin teléfono"} />
          <InfoCard label="Rol" value={roleLabels[user.role] || user.role} />
          <InfoCard label="Estado" value={user.status} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={updateProfile}
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-bold text-neutral-900">Editar perfil</h2>

          <p className="mt-1 text-sm text-neutral-500">
            Actualiza tus datos principales de acceso.
          </p>

          <div className="mt-6 space-y-4">
            <Input
              label="Nombre completo"
              value={fullName}
              onChange={setFullName}
              placeholder="Nombre completo"
            />

            <Input
              label="Correo"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="correo@ejemplo.com"
            />

            <Input
              label="Teléfono"
              value={phone}
              onChange={setPhone}
              placeholder="Opcional"
            />

            <div>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">
                  Usuario
                </span>

                <input
                  type="text"
                  value={user.username}
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border bg-neutral-100 px-4 py-3 text-neutral-500 outline-none"
                />
              </label>

              <p className="mt-2 text-xs text-neutral-400">
                El usuario no se puede modificar para evitar problemas de
                acceso.
              </p>
            </div>

            {profileMessage && <Message text={profileMessage} />}

            <button
              type="submit"
              disabled={loadingProfile}
              className="w-full rounded-xl bg-neutral-950 px-5 py-3 font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>

        <form
          onSubmit={updatePassword}
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-bold text-neutral-900">
            Cambiar contraseña
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Usa una contraseña segura de al menos 8 caracteres.
          </p>

          <div className="mt-6 space-y-4">
            <Input
              label="Contraseña actual"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Contraseña actual"
            />

            <Input
              label="Nueva contraseña"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Nueva contraseña"
            />

            <Input
              label="Confirmar contraseña"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirmar contraseña"
            />

            {passwordMessage && <Message text={passwordMessage} />}

            <button
              type="submit"
              disabled={loadingPassword}
              className="w-full rounded-xl bg-neutral-950 px-5 py-3 font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Preferencias del sistema
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Estas preferencias se guardan únicamente en este dispositivo.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PreferenceButton
            title="Sistema"
            description="Usar preferencia del navegador"
            active={theme === "system"}
            onClick={() => updateTheme("system")}
          />

          <PreferenceButton
            title="Claro"
            description="Mantener interfaz clara"
            active={theme === "light"}
            onClick={() => updateTheme("light")}
          />

          <PreferenceButton
            title="Oscuro"
            description="Activar modo oscuro"
            active={theme === "dark"}
            onClick={() => updateTheme("dark")}
          />
        </div>

        {preferenceMessage && (
          <div className="mt-5">
            <Message text={preferenceMessage} />
          </div>
        )}
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <p className="text-sm text-neutral-500">{label}</p>

      <p className="mt-2 break-words font-bold text-neutral-950">{value}</p>
    </div>
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

function Message({ text }: { text: string }) {
  const isSuccess =
    text.toLowerCase().includes("correctamente") ||
    text.toLowerCase().includes("guardada");

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        isSuccess
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {text}
    </div>
  );
}

function PreferenceButton({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition ${
        active
          ? "border-neutral-950 bg-neutral-950 text-white"
          : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-950"
      }`}
    >
      <p className="font-bold">{title}</p>

      <p
        className={`mt-2 text-sm ${
          active ? "text-white/70" : "text-neutral-500"
        }`}
      >
        {description}
      </p>
    </button>
  );
}