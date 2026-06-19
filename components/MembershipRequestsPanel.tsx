"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MembershipRequest = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  member_name?: string;
  username?: string;
  plan_name: string;
  duration_days: number;
  price: string | number;
  schedule?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export default function MembershipRequestsPanel({
  requests,
}: {
  requests: MembershipRequest[];
}) {
  const router = useRouter();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);
      return {
        ok: false,
        message:
          "La API no respondió correctamente. Revisa app/api/gym/membership-requests/route.ts",
      };
    }
  }

  async function reviewRequest(
    requestId: string,
    action: "APPROVE" | "REJECT"
  ) {
    const confirmed = window.confirm(
      action === "APPROVE"
        ? "¿Deseas aprobar esta solicitud de membresía?"
        : "¿Deseas rechazar esta solicitud de membresía?"
    );

    if (!confirmed) return;

    setLoadingId(requestId);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/membership-requests?requestId=${encodeURIComponent(
          requestId
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al revisar solicitud");
        return;
      }

      setMessage(data.message || "Solicitud actualizada correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error revisando solicitud:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Solicitudes de membresía
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Aprueba o rechaza las solicitudes enviadas por los miembros.
          </p>
        </div>

        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
          Total: {requests.length}
        </span>
      </div>

      {message && (
        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("correctamente") ||
            message.toLowerCase().includes("aprobada") ||
            message.toLowerCase().includes("rechazada")
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
            Todavía no hay solicitudes.
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="rounded-2xl border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">
                    {request.member_name || "Miembro"}
                  </h3>

                  <p className="mt-1 text-sm text-neutral-500">
                    {request.username ? `@${request.username} · ` : ""}
                    {request.plan_name}
                  </p>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <Info
                      label="Duración"
                      value={`${request.duration_days} días`}
                    />

                    <Info
                      label="Precio"
                      value={`$${Number(request.price || 0).toFixed(2)}`}
                    />

                    <Info
                      label="Horarios"
                      value={
                        request.schedule ||
                        "Consultar horarios disponibles en el local"
                      }
                    />
                  </div>

                  {request.notes && (
                    <p className="mt-3 text-sm text-neutral-500">
                      Nota: {request.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <StatusBadge status={request.status} />

                  {request.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => reviewRequest(request.id, "APPROVE")}
                        disabled={loadingId === request.id}
                        className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingId === request.id ? "Procesando..." : "Aprobar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => reviewRequest(request.id, "REJECT")}
                        disabled={loadingId === request.id}
                        className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-neutral-800">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "APPROVED"
      ? "bg-green-100 text-green-700"
      : status === "PENDING"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  const label =
    status === "APPROVED"
      ? "APROBADA"
      : status === "PENDING"
      ? "PENDIENTE"
      : "RECHAZADA";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}