"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type MembershipOption = {
  id: string;
  member_id: string;
  member_name: string;
  username: string;
  plan_name: string | null;
  plan_price: string | number | null;
  start_date: string;
  end_date: string;
  status: string;
};

type Payment = {
  id: string;
  membership_id: string | null;
  member_id: string;
  amount: string | number;
  method: string;
  reference_code?: string | null;
  notes?: string | null;
  payment_date: string;
  status: string;
  created_at: string;
  member_name: string;
  username: string;
  plan_name?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

const paymentMethods = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "OTHER", label: "Otro" },
];

export default function PaymentsManager({
  payments: rawPayments,
  memberships: rawMemberships,
  canEdit,
}: {
  payments?: Payment[];
  memberships?: MembershipOption[];
  canEdit: boolean;
}) {
  const router = useRouter();

  const payments = Array.isArray(rawPayments) ? rawPayments : [];
  const memberships = Array.isArray(rawMemberships) ? rawMemberships : [];

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [membershipId, setMembershipId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceCode, setReferenceCode] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMembershipId, setEditMembershipId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("CASH");
  const [editReferenceCode, setEditReferenceCode] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState(today);
  const [editNotes, setEditNotes] = useState("");

  function handleMembershipChange(value: string) {
    setMembershipId(value);

    const membership = memberships.find((item) => item.id === value);

    if (membership?.plan_price) {
      setAmount(String(Number(membership.plan_price || 0)));
    }
  }

  function startEdit(payment: Payment) {
    setMessage("");
    setEditingId(payment.id);
    setEditMembershipId(payment.membership_id || "");
    setEditAmount(String(Number(payment.amount || 0)));
    setEditPaymentMethod(payment.method || "CASH");
    setEditReferenceCode(payment.reference_code || "");
    setEditPaymentDate(formatInputDate(payment.payment_date));
    setEditNotes(payment.notes || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMembershipId("");
    setEditAmount("");
    setEditPaymentMethod("CASH");
    setEditReferenceCode("");
    setEditPaymentDate(today);
    setEditNotes("");
  }

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);

      return {
        ok: false,
        message:
          "La API no respondió correctamente. Revisa app/api/gym/payments/route.ts",
      };
    }
  }

  async function createPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!membershipId) {
      setMessage("Selecciona una membresía");
      return;
    }

    if (Number(amount || 0) <= 0) {
      setMessage("El monto debe ser mayor a 0");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          membershipId,
          amount: Number(amount),
          paymentMethod,
          referenceCode: referenceCode.trim(),
          paymentDate,
          notes: notes.trim(),
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al registrar pago");
        return;
      }

      setMembershipId("");
      setAmount("");
      setPaymentMethod("CASH");
      setReferenceCode("");
      setPaymentDate(today);
      setNotes("");

      setMessage(data.message || "Pago registrado correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error creando pago:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function updatePayment(paymentId: string) {
    if (!editMembershipId) {
      setMessage("Selecciona una membresía");
      return;
    }

    if (Number(editAmount || 0) <= 0) {
      setMessage("El monto debe ser mayor a 0");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/payments?paymentId=${encodeURIComponent(paymentId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            membershipId: editMembershipId,
            amount: Number(editAmount),
            paymentMethod: editPaymentMethod,
            referenceCode: editReferenceCode.trim(),
            paymentDate: editPaymentDate,
            notes: editNotes.trim(),
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al actualizar pago");
        return;
      }

      setMessage(data.message || "Pago actualizado correctamente");
      cancelEdit();
      router.refresh();
    } catch (error) {
      console.error("Error actualizando pago:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function deletePayment(paymentId: string) {
    const confirmed = window.confirm("¿Seguro que deseas eliminar este pago?");

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/gym/payments?paymentId=${encodeURIComponent(paymentId)}`,
        {
          method: "DELETE",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error al eliminar pago");
        return;
      }

      setMessage(data.message || "Pago eliminado correctamente");
      router.refresh();
    } catch (error) {
      console.error("Error eliminando pago:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Pagos registrados" value={String(payments.length)} />
        <SummaryCard title="Total recibido" value={`$${totalPaid.toFixed(2)}`} />
        <SummaryCard title="Membresías disponibles" value={String(memberships.length)} />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">
          Registrar pago
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Registra pagos realizados por miembros del gimnasio.
        </p>

        <form onSubmit={createPayment} className="mt-6 grid gap-4 md:grid-cols-3">
          <MembershipSelect
            label="Membresía"
            value={membershipId}
            onChange={handleMembershipChange}
            memberships={memberships}
          />

          <Input
            label="Monto $"
            type="number"
            step="0.01"
            value={amount}
            onChange={setAmount}
            placeholder="25.00"
          />

          <Select
            label="Método"
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={paymentMethods}
          />

          <Input
            label="Referencia"
            value={referenceCode}
            onChange={setReferenceCode}
            placeholder="Opcional"
          />

          <Input
            label="Fecha de pago"
            type="date"
            value={paymentDate}
            onChange={setPaymentDate}
          />

          <Input
            label="Notas"
            value={notes}
            onChange={setNotes}
            placeholder="Opcional"
          />

          <button
            type="submit"
            disabled={loading || memberships.length === 0}
            className="rounded-xl bg-neutral-950 px-5 py-3 font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-3"
          >
            {loading ? "Guardando..." : "Registrar pago"}
          </button>
        </form>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("correctamente")
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              Historial de pagos
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Pagos registrados en el gimnasio.
            </p>
          </div>

          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
            Total: {payments.length}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {payments.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Todavía no hay pagos registrados.
            </div>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="rounded-2xl border p-4">
                {editingId === payment.id ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <MembershipSelect
                      label="Membresía"
                      value={editMembershipId}
                      onChange={setEditMembershipId}
                      memberships={memberships}
                    />

                    <Input
                      label="Monto $"
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={setEditAmount}
                    />

                    <Select
                      label="Método"
                      value={editPaymentMethod}
                      onChange={setEditPaymentMethod}
                      options={paymentMethods}
                    />

                    <Input
                      label="Referencia"
                      value={editReferenceCode}
                      onChange={setEditReferenceCode}
                    />

                    <Input
                      label="Fecha de pago"
                      type="date"
                      value={editPaymentDate}
                      onChange={setEditPaymentDate}
                    />

                    <Input
                      label="Notas"
                      value={editNotes}
                      onChange={setEditNotes}
                    />

                    <div className="flex gap-2 md:col-span-3">
                      <button
                        type="button"
                        onClick={() => updatePayment(payment.id)}
                        disabled={loading}
                        className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Guardar
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={loading}
                        className="rounded-xl border px-5 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-neutral-950">
                          {payment.member_name}
                        </h3>

                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                          PAGADO
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-neutral-500">
                        @{payment.username} · {payment.plan_name || "Sin plan"}
                      </p>

                      <p className="mt-1 text-sm text-neutral-500">
                        {formatPaymentMethod(payment.method)} ·{" "}
                        {formatDate(payment.payment_date)}
                        {payment.reference_code
                          ? ` · Ref: ${payment.reference_code}`
                          : ""}
                      </p>

                      {payment.notes && (
                        <p className="mt-1 text-sm text-neutral-500">
                          Nota: {payment.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-black text-neutral-900">
                        ${Number(payment.amount || 0).toFixed(2)}
                      </span>

                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(payment)}
                            disabled={loading}
                            className="rounded-lg border px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => deletePayment(payment.id)}
                            disabled={loading}
                            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}

function MembershipSelect({
  label,
  value,
  onChange,
  memberships,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  memberships: MembershipOption[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
      >
        <option value="">Seleccionar membresía</option>

        {memberships.map((membership) => (
          <option key={membership.id} value={membership.id}>
            {membership.member_name} · {membership.plan_name || "Sin plan"} ·{" "}
            {membership.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">
        {label}
      </span>

      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none focus:border-neutral-950"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatInputDate(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPaymentMethod(method: string) {
  const labels: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    OTHER: "Otro",
  };

  return labels[method] || method;
}