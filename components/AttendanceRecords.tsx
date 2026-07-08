"use client";

type AttendanceRecord = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  user_name?: string | null;
  username?: string | null;
  role?: string | null;
};

export default function AttendanceRecords({
  records,
  title,
  description,
  showUser = false,
}: {
  records: AttendanceRecord[];
  title: string;
  description: string;
  showUser?: boolean;
}) {
  const safeRecords = Array.isArray(records) ? records : [];

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">{title}</h2>

          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        </div>

        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
          Total: {safeRecords.length}
        </span>
      </div>

      <div className="mt-6 space-y-4">
        {safeRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
            Todavía no hay registros de asistencia.
          </div>
        ) : (
          safeRecords.map((record) => (
            <div key={record.id} className="rounded-2xl border p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  {showUser && (
                    <>
                      <h3 className="text-lg font-black text-neutral-950">
                        {record.user_name || "Usuario"}
                      </h3>

                      <p className="mt-1 text-sm text-neutral-500">
                        @{record.username || "sin_usuario"} ·{" "}
                        {roleLabel(record.role || "")}
                      </p>
                    </>
                  )}

                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    Fecha: {formatDate(record.attendance_date)}
                  </p>
                </div>

                <StatusBadge status={record.status} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <InfoBox
                  label="Entrada"
                  value={record.check_in_time || "Sin entrada"}
                />

                <InfoBox
                  label="Salida"
                  value={record.check_out_time || "Sin salida"}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <p className="text-xs text-neutral-500">{label}</p>

      <p className="mt-1 text-sm font-black text-neutral-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isClosed = status === "CLOSED";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${
        isClosed
          ? "bg-green-100 text-green-700"
          : "bg-yellow-100 text-yellow-700"
      }`}
    >
      {isClosed ? "CERRADO" : "ABIERTO"}
    </span>
  );
}

function roleLabel(role: string) {
  if (role === "GYM_ADMIN") return "Administrador";
  if (role === "EMPLOYEE") return "Empleado";
  if (role === "MEMBER") return "Miembro";

  return "Usuario";
}

function formatDate(value: string) {
  if (!value) return "Sin fecha";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}