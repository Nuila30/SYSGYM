"use client";

import { useEffect, useState } from "react";
import AttendanceScanner from "@/components/AttendanceScanner";
import AttendanceRecords from "@/components/AttendanceRecords";

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

type ApiResponse = {
  ok?: boolean;
  message?: string;
  myAttendance?: AttendanceRecord[];
  gymAttendance?: AttendanceRecord[];
};

export default function AttendanceLivePanel({
  initialMyAttendance,
  initialGymAttendance,
  canViewGymAttendance,
}: {
  initialMyAttendance: AttendanceRecord[];
  initialGymAttendance: AttendanceRecord[];
  canViewGymAttendance: boolean;
}) {
  const [myAttendance, setMyAttendance] = useState(initialMyAttendance);
  const [gymAttendance, setGymAttendance] = useState(initialGymAttendance);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");

  async function loadHistory() {
    setLoadingHistory(true);
    setHistoryMessage("");

    try {
      const res = await fetch("/api/gym/attendance/history", {
        method: "GET",
        cache: "no-store",
      });

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.ok) {
        setHistoryMessage(data.message || "No se pudo actualizar el historial");
        return;
      }

      setMyAttendance(data.myAttendance || []);
      setGymAttendance(data.gymAttendance || []);
    } catch (error) {
      console.error("Error actualizando historial:", error);
      setHistoryMessage("Error de conexión al actualizar historial");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadHistory();
    }, 8000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      <AttendanceScanner onMarked={loadHistory} />

      <div className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-bold text-neutral-900">
            Historial de asistencia
          </p>

          <p className="text-xs text-neutral-500">
            Se actualiza automáticamente después de marcar entrada o salida.
          </p>
        </div>

        <button
          type="button"
          onClick={loadHistory}
          disabled={loadingHistory}
          className="rounded-xl border px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingHistory ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {historyMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {historyMessage}
        </div>
      )}

      <AttendanceRecords
        records={myAttendance}
        title="Mi asistencia"
        description="Tus últimas marcas de entrada y salida."
      />

      {canViewGymAttendance && (
        <AttendanceRecords
          records={gymAttendance}
          title="Asistencia del gimnasio"
          description="Registros recientes de usuarios del gimnasio."
          showUser
        />
      )}
    </>
  );
}