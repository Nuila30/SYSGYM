"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type DashboardMenuProps = {
  fullName: string;
  username: string;
  role: string;
};

type MenuItem = {
  label: string;
  href: string;
  roles: string[];
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "SUPER ADMIN",
  GYM_ADMIN: "ADMINISTRADOR",
  EMPLOYEE: "EMPLEADO",
  MEMBER: "MIEMBRO",
};

const menuItems: MenuItem[] = [
  
  {
    label: "Dashboard",
    href: "/dashboard",
    roles: ["SUPER_ADMIN", "GYM_ADMIN", "EMPLOYEE", "MEMBER"],
  },
  {
    label: "QR Asistencia",
    href: "/dashboard/attendance",
    roles: ["GYM_ADMIN", "EMPLOYEE", "MEMBER"],
  },
  {
    label: "Gimnasios",
    href: "/dashboard/gyms",
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Planes",
    href: "/dashboard/plans",
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Usuarios",
    href: "/dashboard/users",
    roles: ["GYM_ADMIN", "EMPLOYEE"],
  },
  {
    label: "Membresías",
    href: "/dashboard/memberships",
    roles: ["GYM_ADMIN", "EMPLOYEE", "MEMBER"],
  },
  {
    label: "Pagos",
    href: "/dashboard/payments",
    roles: ["GYM_ADMIN", "EMPLOYEE"],
  },
  {
    label: "Productos",
    href: "/dashboard/products",
    roles: ["GYM_ADMIN", "EMPLOYEE"],
  },
  {
    label: "Inventario",
    href: "/dashboard/inventory",
    roles: ["GYM_ADMIN", "EMPLOYEE"],
  },
  {
    label: "Ventas",
    href: "/dashboard/sales",
    roles: ["GYM_ADMIN", "EMPLOYEE"],
  },
  {
    label: "Configuración",
    href: "/dashboard/settings",
    roles: ["SUPER_ADMIN", "GYM_ADMIN", "EMPLOYEE", "MEMBER"],
  },
];

export default function DashboardMenu({
  fullName,
  username,
  role,
}: DashboardMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loadingLogout, setLoadingLogout] = useState(false);

  const visibleItems = menuItems.filter((item) => item.roles.includes(role));

  async function logout() {
    setLoadingLogout(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error cerrando sesión:", error);
    } finally {
      setLoadingLogout(false);
    }
  }

  return (
    <aside className="w-full shrink-0 border-r bg-white lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:overflow-y-auto">
      <div className="p-5">
        <div className="rounded-2xl bg-neutral-950 p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
            Gym SaaS
          </p>

          <h2 className="mt-3 text-lg font-black leading-tight">
            Sistema de gestión
          </h2>

          <p className="mt-2 text-xs leading-5 text-neutral-400">
            Software como servicio para gimnasios.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border bg-neutral-50 p-4">
          <p className="text-sm font-bold text-neutral-900">{fullName}</p>

          <p className="mt-1 text-xs text-neutral-500">@{username}</p>

          <span className="mt-3 inline-flex rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
            {roleLabels[role] || role}
          </span>
        </div>

        <nav className="mt-5 flex flex-col gap-2">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                  isActive
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-950 hover:bg-neutral-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={logout}
          disabled={loadingLogout}
          className="mt-5 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingLogout ? "Cerrando..." : "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}