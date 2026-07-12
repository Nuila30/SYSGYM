"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setMessage("Ingresa tu usuario y contraseña");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Usuario o contraseña incorrectos");
        return;
      }

      if (data.forceChangePassword || data.mustChangePassword) {
        router.push("/change-password");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 py-6 md:px-8">
      <div className="absolute inset-0">
        <Image
          src="/images/GYM_TO.png"
          alt="Fondo gimnasio"
          fill
          priority
          className="object-cover opacity-20"
        />

        <div className="absolute inset-0 bg-black/85" />
        <div className="absolute left-0 top-0 h-[420px] w-[420px] rounded-full bg-red-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-white/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[34px] border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        {/* PANEL IZQUIERDO */}
        <section className="relative hidden overflow-hidden bg-neutral-950 text-white lg:block">
          <Image
            src="/images/GYM_TO.png"
            alt="Gimnasio"
            fill
            priority
            className="object-cover"
          />

          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/45" />

          <div className="relative z-10 flex h-full min-h-[760px] flex-col justify-between p-10">
            <div className="flex items-center justify-between gap-4">
              <LogoBox />

              <span className="rounded-full border border-white/20 bg-black/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white/80 backdrop-blur-md">
                Sistema autorizado
              </span>
            </div>

            <div className="max-w-xl">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur-md">
                Acceso del gimnasio
              </span>

              <h1 className="mt-6 text-5xl font-black leading-tight tracking-tight">
                Bienvenido a tu panel
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-white/80">
                Consulta y gestiona la información de tu gimnasio desde un solo
                lugar.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/45 p-6 shadow-2xl backdrop-blur-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                    Plataforma interna
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Gestión del gimnasio
                  </h2>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white/80">
                  Acceso seguro
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PANEL DERECHO */}
        <section className="flex items-center justify-center bg-neutral-100 px-6 py-10 md:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <LogoBox />

              <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-red-600">
                Acceso seguro
              </p>

              <h2 className="mt-2 text-4xl font-black tracking-tight text-neutral-950">
                Iniciar sesión
              </h2>

              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Ingresa tu usuario y contraseña para continuar.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-800">
                  Usuario
                </span>

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. Jua90Per89"
                  autoComplete="username"
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-5 py-4 text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-900/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-800">
                  Contraseña
                </span>

                <div className="flex overflow-hidden rounded-2xl border border-neutral-300 bg-white transition focus-within:border-neutral-950 focus-within:ring-4 focus-within:ring-neutral-900/10">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    autoComplete="current-password"
                    className="w-full bg-transparent px-5 py-4 text-neutral-900 outline-none placeholder:text-neutral-400"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="px-5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>

              {message && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-neutral-950 px-5 py-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Entrando..." : "Entrar al sistema"}
              </button>
            </form>

            
          </div>
        </section>
      </div>
    </main>
  );
}

function LogoBox() {
  return (
    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-xl ring-1 ring-neutral-200">
      <Image
        src="/images/logo.png"
        alt="Logo"
        width={80}
        height={80}
        priority
        className="h-full w-full object-contain"
      />
    </div>
  );
}