"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MemberUser = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
};

type MembershipPlan = {
  id: string;
  name: string;
  duration_days: number;
  price: string | number;
  is_active: boolean;
};

export default function AssignMembershipForm({
  members,
  plans,
}: {
  members: MemberUser[];
  plans: MembershipPlan[];
}) {
  const router = useRouter();

  const [memberId, setMemberId] = useState("");
  const [planId, setPlanId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function assignMembership(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/memberships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId,
          planId,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Error al asignar membresía");
        return;
      }

      setMessage("Membresía asignada correctamente");
      setMemberId("");
      setPlanId("");
      setNotes("");

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
      onSubmit={assignMembership}
      className="rounded-2xl border bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-bold text-neutral-900">
        Asignar membresía
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        Selecciona un miembro y un plan activo.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">
            Miembro
          </span>

          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-900"
          >
            <option value="">Seleccionar miembro</option>

            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name} - @{member.username}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">
            Plan
          </span>

          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-900"
          >
            <option value="">Seleccionar plan</option>

            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} - {plan.duration_days} días - $
                {Number(plan.price).toFixed(2)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">
            Observación
          </span>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            className="min-h-24 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900"
          />
        </label>
      </div>

      {message && (
        <div className="mt-5 rounded-xl border bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {loading ? "Asignando..." : "Asignar membresía"}
      </button>
    </form>
  );
}