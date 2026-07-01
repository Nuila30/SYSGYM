type AttendanceRecord = {
    id: string;
    attendance_date: string;
    check_in_at: string | null;
    check_out_at: string | null;
    status: string;
    full_name?: string | null;
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
    return (
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
  
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          </div>
  
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">
            Total: {records.length}
          </span>
        </div>
  
        <div className="mt-6 space-y-4">
          {records.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-neutral-500">
              Todavía no hay registros de asistencia.
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    {showUser && (
                      <div>
                        <h3 className="font-bold text-neutral-950">
                          {record.full_name || "Usuario"}
                        </h3>
  
                        <p className="mt-1 text-sm text-neutral-500">
                          @{record.username || "sin_usuario"} ·{" "}
                          {record.role || "ROL"}
                        </p>
                      </div>
                    )}
  
                    <p className="mt-2 text-sm text-neutral-500">
                      Fecha:{" "}
                      <span className="font-bold text-neutral-900">
                        {formatDate(record.attendance_date)}
                      </span>
                    </p>
  
                    <p className="mt-1 text-sm text-neutral-500">
                      Entrada:{" "}
                      <span className="font-bold text-neutral-900">
                        {formatTime(record.check_in_at)}
                      </span>
                    </p>
  
                    <p className="mt-1 text-sm text-neutral-500">
                      Salida:{" "}
                      <span className="font-bold text-neutral-900">
                        {formatTime(record.check_out_at)}
                      </span>
                    </p>
                  </div>
  
                  <StatusBadge status={record.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }
  
  function StatusBadge({ status }: { status: string }) {
    const isClosed = status === "CLOSED";
  
    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
          isClosed
            ? "bg-green-100 text-green-700"
            : "bg-yellow-100 text-yellow-700"
        }`}
      >
        {isClosed ? "CERRADO" : "ABIERTO"}
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
  
  function formatTime(value?: string | null) {
    if (!value) return "Sin marcar";
  
    return new Date(value).toLocaleTimeString("es-SV", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }