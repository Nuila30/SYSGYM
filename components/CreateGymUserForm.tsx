"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRow = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  must_change_password?: boolean | null;
  temp_password_expires_at?: string | null;
  credentials_email_sent_at?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export default function CreateGymUserForm({
  users: rawUsers,
  currentUserRole,
}: {
  users?: UserRow[];
  currentUserRole: string;
}) {
  const router = useRouter();

  const users = Array.isArray(rawUsers) ? rawUsers : [];

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(
    currentUserRole === "GYM_ADMIN" ? "EMPLOYEE" : "MEMBER"
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    fullName: "",
    phone: "",
    email: "",
    role: "MEMBER",
    status: "ACTIVE",
  });

  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const canCreateEmployees = currentUserRole === "GYM_ADMIN";

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);

      return {
        ok: false,
        message:
          "La API no respondió correctamente. Revisa app/api/gym/users/route.ts",
      };
    }
  }

  function roleLabel(value: string) {
    if (value === "GYM_ADMIN") return "Administrador";
    if (value === "EMPLOYEE") return "Empleado";
    if (value === "MEMBER") return "Miembro";
    return value;
  }

  function startEdit(user: UserRow) {
    setMessage("");
    setEditingId(user.id);

    setEditData({
      fullName: user.full_name || "",
      phone: user.phone || "",
      email: user.email || "",
      role: user.role || "MEMBER",
      status: user.status || "ACTIVE",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!fullName || !phone || !email) {
      setMessage("Completa nombre, teléfono y correo");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          role,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error creando usuario");
        return;
      }

      setMessage(data.message || "Usuario creado correctamente");

      setFullName("");
      setPhone("");
      setEmail("");
      setRole(currentUserRole === "GYM_ADMIN" ? "EMPLOYEE" : "MEMBER");

      router.refresh();
    } catch (error) {
      console.error("Error creando usuario:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(userId: string) {
    setLoadingId(userId);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/users?userId=${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: editData.fullName,
            phone: editData.phone,
            email: editData.email,
            role: editData.role,
            status: editData.status,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error actualizando usuario");
        return;
      }

      setMessage(data.message || "Usuario actualizado correctamente");
      setEditingId(null);
      router.refresh();
    } catch (error) {
      console.error("Error actualizando usuario:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingId(null);
    }
  }

  async function resetPassword(userId: string) {
    const confirmed = window.confirm(
      "¿Deseas generar una nueva contraseña temporal y enviarla por correo?"
    );

    if (!confirmed) return;

    setLoadingId(userId);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/users?userId=${encodeURIComponent(userId)}`,
        {
          method: "PUT",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error regenerando contraseña");
        return;
      }

      setMessage(data.message || "Nueva contraseña enviada correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error regenerando contraseña:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingId(null);
    }
  }

  async function deactivateUser(userId: string) {
    const confirmed = window.confirm(
      "¿Seguro que deseas desactivar este usuario?"
    );

    if (!confirmed) return;

    setLoadingId(userId);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/users?userId=${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error desactivando usuario");
        return;
      }

      setMessage(data.message || "Usuario desactivado correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error desactivando usuario:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.25fr]">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Registrar usuario
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          El usuario y la contraseña temporal se generarán automáticamente y se
          enviarán por correo.
        </p>

        <form onSubmit={createUser} className="mt-6 space-y-5">
          <Input
            label="Nombre completo"
            value={fullName}
            onChange={setFullName}
            placeholder="Nombre completo"
          />

          <Input
            label="Teléfono"
            value={phone}
            onChange={setPhone}
            placeholder="70000000"
          />

          <Input
            label="Correo"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="correo@gmail.com"
          />

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-700">
              Rol
            </span>

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
            >
              {canCreateEmployees && <option value="EMPLOYEE">Empleado</option>}

              <option value="MEMBER">Miembro</option>
            </select>
          </label>

          <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
            Si el usuario olvida su contraseña, puedes generar una nueva
            contraseña temporal. Se enviará por correo y se reenviará cada 8
            horas hasta que la cambie.
          </div>

          {message && <MessageBox message={message} />}

          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Registrando..." : "Registrar usuario"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Usuarios registrados
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Edita empleados y miembros, o regenera su contraseña temporal.
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
            Total: {users.length}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {users.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Todavía no hay usuarios registrados.
            </div>
          ) : (
            users.map((user) => {
              const isEditing = editingId === user.id;
              const canManage =
                user.role !== "GYM_ADMIN" &&
                (currentUserRole === "GYM_ADMIN" ||
                  (currentUserRole === "EMPLOYEE" && user.role === "MEMBER"));

              return (
                <div key={user.id} className="rounded-2xl border p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Input
                          label="Nombre completo"
                          value={editData.fullName}
                          onChange={(value) =>
                            setEditData((current) => ({
                              ...current,
                              fullName: value,
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
                          type="email"
                          value={editData.email}
                          onChange={(value) =>
                            setEditData((current) => ({
                              ...current,
                              email: value,
                            }))
                          }
                        />

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-neutral-700">
                            Rol
                          </span>

                          <select
                            value={editData.role}
                            onChange={(e) =>
                              setEditData((current) => ({
                                ...current,
                                role: e.target.value,
                              }))
                            }
                            className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
                          >
                            {canCreateEmployees && (
                              <option value="EMPLOYEE">Empleado</option>
                            )}

                            <option value="MEMBER">Miembro</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-neutral-700">
                            Estado
                          </span>

                          <select
                            value={editData.status}
                            onChange={(e) =>
                              setEditData((current) => ({
                                ...current,
                                status: e.target.value,
                              }))
                            }
                            className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
                          >
                            <option value="ACTIVE">Activo</option>
                            <option value="INACTIVE">Inactivo</option>
                          </select>
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateUser(user.id)}
                          disabled={loadingId === user.id}
                          className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loadingId === user.id
                            ? "Guardando..."
                            : "Guardar cambios"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={loadingId === user.id}
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
                            {user.full_name}
                          </h3>

                          <p className="mt-1 text-sm text-neutral-500">
                            @{user.username} · {user.email}
                          </p>

                          <p className="text-sm text-neutral-500">
                            {user.phone}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge label={roleLabel(user.role)} />
                          <Badge
                            label={user.status}
                            active={user.status === "ACTIVE"}
                          />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <Info label="Usuario" value={`@${user.username}`} />
                        <Info label="Correo" value={user.email} />
                        <Info label="Teléfono" value={user.phone} />
                      </div>

                      {user.must_change_password && (
                        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                          Contraseña temporal pendiente de cambio.
                        </div>
                      )}

                      {canManage && (
                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(user)}
                            disabled={loadingId === user.id}
                            className="rounded-lg border px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => resetPassword(user.id)}
                            disabled={loadingId === user.id}
                            className="rounded-lg bg-neutral-950 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Nueva contraseña
                          </button>

                          {user.status === "ACTIVE" && (
                            <button
                              type="button"
                              onClick={() => deactivateUser(user.id)}
                              disabled={loadingId === user.id}
                              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Desactivar
                            </button>
                          )}
                        </div>
                      )}
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="text-xs text-neutral-500">{label}</p>

      <p className="mt-1 break-words text-sm font-black text-neutral-950">
        {value}
      </p>
    </div>
  );
}

function Badge({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        active
          ? "bg-green-100 text-green-700"
          : "bg-neutral-200 text-neutral-600"
      }`}
    >
      {label}
    </span>
  );
}

function MessageBox({ message }: { message: string }) {
  const success =
    message.toLowerCase().includes("correctamente") ||
    message.toLowerCase().includes("enviada") ||
    message.toLowerCase().includes("actualizado") ||
    message.toLowerCase().includes("desactivado");

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