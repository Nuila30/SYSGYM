"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MembershipPlan = {
  id: string;
  name: string;
  duration_days: number;
  price: string | number;
  schedule: string | null;
  is_active: boolean;
};

type MembershipRequest = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  plan_name: string;
  duration_days: number;
  price: string | number;
  schedule?: string | null;
};

export default function MemberMembershipRequestForm({
  plans,
  requests,
  currentMembership,
}: {
  plans: MembershipPlan[];
  requests: MembershipRequest[];
  currentMembership: any;
}) {
  const router = useRouter();

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const activePlans = plans.filter((plan) => plan.is_active);
  const selectedPlan = activePlans.find((plan) => plan.id === selectedPlanId);

  const hasPendingRequest = requests.some(
    (request) => request.status === "PENDING"
  );

  async function submitRequest() {
    if (!selectedPlanId) {
      setMessage("Selecciona una membresía para continuar");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/membership-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          notes: "Solicitud enviada desde el panel del usuario",
        }),
      });
      
      const text = await res.text();
      
      let data: any = null;
      
      try {
        data = JSON.parse(text);
      } catch {
        console.error("Respuesta no JSON:", text);
        setMessage("La API no respondió correctamente. Revisa la terminal de Next.js.");
        return;
      }
      
      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al enviar solicitud");
        return;
      }

      setMessage(
        "Solicitud enviada correctamente. Recuerda que el pago se realiza únicamente en el local."
      );

      setSelectedPlanId("");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Mi membresía actual
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Consulta tu estado actual antes de solicitar una nueva membresía.
        </p>

        <div className="mt-6 rounded-xl bg-neutral-50 p-4">
          <p className="text-sm text-neutral-500">Plan actual</p>

          <h3 className="mt-1 text-2xl font-bold text-neutral-900">
            {currentMembership?.plan_name || "Sin membresía activa"}
          </h3>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Info
              label="Inicio"
              value={formatDate(currentMembership?.start_date)}
            />

            <Info
              label="Vence"
              value={formatDate(currentMembership?.end_date)}
            />

            <Info
              label="Estado"
              value={currentMembership?.status || "SIN_MEMBRESIA"}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Solicitar membresía
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Selecciona el plan que deseas solicitar.
            </p>
          </div>

          {hasPendingRequest && (
            <span className="w-fit rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
              Solicitud pendiente
            </span>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-semibold text-yellow-800">
          Todos los pagos de membresía se realizarán únicamente en el local.
        </div>

        {hasPendingRequest ? (
          <div className="mt-6 rounded-xl border border-dashed p-6 text-sm text-neutral-500">
            Ya tienes una solicitud pendiente. Espera a que sea revisada por el
            personal del gimnasio.
          </div>
        ) : activePlans.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed p-6 text-sm text-neutral-500">
            Actualmente no hay membresías activas disponibles.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activePlans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`rounded-2xl border p-5 text-left shadow-sm transition ${
                      isSelected
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-900 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">
                          {plan.name}
                        </h3>

                        <p
                          className={`mt-1 text-sm ${
                            isSelected ? "text-neutral-300" : "text-neutral-500"
                          }`}
                        >
                          {plan.duration_days} días de acceso
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          isSelected
                            ? "bg-white text-neutral-900"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        ${Number(plan.price).toFixed(2)}
                      </span>
                    </div>

                    <div
                      className={`mt-5 rounded-xl p-4 ${
                        isSelected ? "bg-white/10" : "bg-neutral-50"
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold ${
                          isSelected ? "text-neutral-300" : "text-neutral-500"
                        }`}
                      >
                        Horarios
                      </p>

                      <p className="mt-1 text-sm font-semibold">
                        {plan.schedule ||
                          "Consultar horarios disponibles en el local"}
                      </p>
                    </div>

                    <div
                      className={`mt-4 rounded-xl p-3 text-xs font-semibold ${
                        isSelected
                          ? "bg-white text-neutral-900"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      Pago únicamente en el local
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPlan && (
              <div className="mt-6 rounded-2xl border bg-neutral-50 p-5">
                <p className="text-sm text-neutral-500">
                  Membresía seleccionada
                </p>

                <h3 className="mt-1 text-xl font-bold text-neutral-900">
                  {selectedPlan.name}
                </h3>

                <p className="mt-2 text-sm text-neutral-600">
                  Duración: {selectedPlan.duration_days} días · Precio: $
                  {Number(selectedPlan.price).toFixed(2)}
                </p>

                <p className="mt-1 text-sm text-neutral-600">
                  Horarios:{" "}
                  {selectedPlan.schedule ||
                    "Consultar horarios disponibles en el local"}
                </p>

                <p className="mt-2 text-sm font-semibold text-neutral-800">
                  El pago se realizará únicamente en el local.
                </p>
              </div>
            )}

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
              type="button"
              onClick={submitRequest}
              disabled={loading || !selectedPlanId}
              className="mt-6 w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Enviando solicitud..." : "Solicitar esta membresía"}
            </button>
          </>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Mis solicitudes
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Historial de solicitudes enviadas.
        </p>

        <div className="mt-6 space-y-4">
          {requests.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Todavía no has solicitado membresías.
            </div>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-neutral-900">
                      {request.plan_name}
                    </h3>

                    <p className="mt-1 text-sm text-neutral-500">
                      {request.duration_days} días · $
                      {Number(request.price).toFixed(2)}
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      Horarios:{" "}
                      {request.schedule ||
                        "Consultar horarios disponibles en el local"}
                    </p>
                  </div>

                  <StatusBadge status={request.status} />
                </div>

                {request.notes && (
                  <p className="mt-3 text-sm text-neutral-500">
                    Nota: {request.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-semibold text-neutral-800">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "APPROVED" || status === "ACTIVE"
      ? "bg-green-100 text-green-700"
      : status === "PENDING"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {status}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}