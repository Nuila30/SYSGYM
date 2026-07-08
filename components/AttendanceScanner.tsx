"use client";

import { useEffect, useRef, useState } from "react";

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  action?: "CHECK_IN" | "CHECK_OUT" | "COMPLETED";
};

export default function AttendanceScanner({
  onMarked,
}: {
  onMarked?: () => void | Promise<void>;
}) {
  const scannerRef = useRef<any>(null);
  const scanningRef = useRef(false);
  const processingRef = useRef(false);
  const lastScanRef = useRef("");

  const [manualToken, setManualToken] = useState("");
  const [message, setMessage] = useState("");
  const [cameraMessage, setCameraMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token");

    if (tokenFromUrl) {
      window.history.replaceState(null, "", "/dashboard/attendance");
      markAttendance(tokenFromUrl);
    }

    return () => {
      stopCamera();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);

      return {
        ok: false,
        message:
          "La API no respondió correctamente. Revisa app/api/gym/attendance/mark/route.ts",
      };
    }
  }

  async function markAttendance(tokenValue: string) {
    const cleanToken = String(tokenValue || "").trim();

    if (!cleanToken) {
      setMessage("Ingresa o escanea un QR válido");
      return;
    }

    if (processingRef.current) return;

    processingRef.current = true;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/attendance/mark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: cleanToken,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        setMessage(data.message || data.error || "Error marcando asistencia");
        return;
      }

      const successMessage =
        data.message || "Asistencia registrada correctamente";

      setManualToken("");
      setMessage(successMessage);

      window.alert(successMessage);

      try {
        await onMarked?.();
      } catch (error) {
        console.error("Error actualizando historial:", error);
      }
    } catch (error) {
      console.error("Error marcando asistencia:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);

      setTimeout(() => {
        processingRef.current = false;
      }, 2500);
    }
  }

  async function startCamera() {
    setCameraMessage("");
    setMessage("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      const cameras = await Html5Qrcode.getCameras();

      if (!cameras || cameras.length === 0) {
        setCameraMessage(
          "No se encontró ninguna cámara disponible. Revisa que tu cámara esté conectada y que el navegador tenga permiso."
        );
        return;
      }

      const cameraId =
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("back")
        )?.id || cameras[0].id;

      const scanner = new Html5Qrcode("attendance-qr-reader");

      scannerRef.current = scanner;
      scanningRef.current = true;

      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: {
            width: 260,
            height: 260,
          },
          aspectRatio: 1.777,
        },
        async (decodedText: string) => {
          const value = String(decodedText || "").trim();

          if (!value) return;

          if (value === lastScanRef.current) return;

          lastScanRef.current = value;

          await markAttendance(value);

          setTimeout(() => {
            lastScanRef.current = "";
          }, 5000);
        },
        () => {
          // Evitamos mostrar errores por cada frame de la cámara.
        }
      );

      setCameraActive(true);
    } catch (error) {
      console.error("Error abriendo cámara:", error);

      setCameraMessage(
        "No se pudo abrir la cámara. Revisa permisos del navegador, que otra app no esté usando la cámara, o prueba en Chrome/Edge."
      );
    }
  }

  async function stopCamera() {
    scanningRef.current = false;

    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current;

        const isScanning =
          typeof scanner.getState === "function"
            ? scanner.getState() === 2
            : cameraActive;

        if (isScanning) {
          await scanner.stop();
        }

        if (typeof scanner.clear === "function") {
          await scanner.clear();
        }

        scannerRef.current = null;
      }
    } catch (error) {
      console.error("Error deteniendo cámara:", error);
    } finally {
      setCameraActive(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-neutral-900">
        Marcar asistencia
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        Escanea el QR del gimnasio para registrar tu entrada o salida del día.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl bg-neutral-50 p-5">
          <div className="overflow-hidden rounded-2xl border bg-black">
            <div
              id="attendance-qr-reader"
              className="min-h-[320px] w-full bg-black"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={loading}
                className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Activar cámara
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                Detener cámara
              </button>
            )}
          </div>

          {cameraMessage && (
            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
              {cameraMessage}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <h3 className="font-bold text-neutral-900">Marcación manual</h3>

          <p className="mt-1 text-sm text-neutral-500">
            Úsalo solo si la cámara no puede leer el QR.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">
                Código o URL del QR
              </span>

              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Pega aquí el código del QR"
                className="w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
              />
            </label>

            <button
              type="button"
              onClick={() => markAttendance(manualToken)}
              disabled={loading}
              className="w-full rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Marcando..." : "Marcar asistencia"}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("correctamente") ||
            message.toLowerCase().includes("registrada")
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
    </section>
  );
}