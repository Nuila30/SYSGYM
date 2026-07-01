"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

type QrToken = {
  id: string;
  gym_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  token?: QrToken | null;
};

export default function GymQrManager({
  initialToken,
  gymName,
}: {
  initialToken?: QrToken | null;
  gymName: string;
}) {
  const [token, setToken] = useState<QrToken | null>(initialToken || null);
  const [qrImage, setQrImage] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);

  useEffect(() => {
    if (!token?.token) {
      setQrUrl("");
      return;
    }

    const url = `${window.location.origin}/dashboard/attendance?token=${token.token}`;
    setQrUrl(url);
  }, [token]);

  useEffect(() => {
    async function buildQr() {
      if (!qrUrl) {
        setQrImage("");
        return;
      }

      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 420,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      setQrImage(dataUrl);
    }

    buildQr();
  }, [qrUrl]);

  async function readJsonResponse(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      console.error("Respuesta no JSON:", text);

      return {
        ok: false,
        message:
          "La API no respondió correctamente. Revisa app/api/gym/attendance/qr/route.ts",
      };
    }
  }

  async function generateQr() {
    const confirmed = window.confirm(
      token
        ? "¿Deseas generar un nuevo QR? El QR anterior dejará de funcionar."
        : "¿Deseas generar el QR de asistencia para este gimnasio?"
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/gym/attendance/qr", {
        method: "POST",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok || !data.token) {
        setMessage(data.message || data.error || "Error generando QR");
        return;
      }

      setToken(data.token);
      setMessage(data.message || "QR generado correctamente");
    } catch (error) {
      console.error("Error generando QR:", error);
      setMessage("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function downloadQrImage() {
    if (!token || !qrUrl) {
      setMessage("Primero genera un QR para poder descargar la imagen");
      return;
    }

    setDownloadingImage(true);
    setMessage("");

    try {
      const highQualityQr = await QRCode.toDataURL(qrUrl, {
        width: 800,
        margin: 2,
        errorCorrectionLevel: "H",
      });

      const qrImg = await loadImage(highQualityQr);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setMessage("No se pudo crear la imagen");
        return;
      }

      canvas.width = 1200;
      canvas.height = 1600;

      ctx.fillStyle = "#f8f8f8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ffffff";
      roundRect(ctx, 50, 40, 1100, 1520, 28);
      ctx.fill();

      ctx.fillStyle = "#0a0a0a";
      roundRect(ctx, 50, 40, 1100, 180, 28);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";

      ctx.font = "bold 56px Arial";
      ctx.fillText("QR DE ASISTENCIA", canvas.width / 2, 105);

      ctx.font = "28px Arial";
      ctx.fillStyle = "#d4d4d4";
      ctx.fillText("Escanea para marcar entrada o salida", canvas.width / 2, 150);

      ctx.fillStyle = "#111111";
      ctx.font = "bold 46px Arial";
      ctx.fillText(gymName, canvas.width / 2, 300);

      ctx.fillStyle = "#5a5a5a";
      ctx.font = "28px Arial";
      ctx.fillText(
        "Sistema de control de asistencia del gimnasio",
        canvas.width / 2,
        345
      );

      ctx.fillStyle = "#f3f4f6";
      roundRect(ctx, 120, 395, 960, 250, 24);
      ctx.fill();

      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 2;
      roundRect(ctx, 120, 395, 960, 250, 24);
      ctx.stroke();

      ctx.fillStyle = "#111111";
      ctx.font = "bold 34px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Instrucciones", canvas.width / 2, 445);

      const steps = [
        "1. Escanea este QR con la cámara del celular.",
        "2. Si no tienes entrada registrada hoy, marcará ENTRADA.",
        "3. Si ya tienes entrada registrada hoy, marcará SALIDA.",
        "4. Solo se permite una entrada y una salida por fecha.",
      ];

      ctx.textAlign = "left";
      ctx.fillStyle = "#222222";
      ctx.font = "28px Arial";

      let stepY = 500;

      steps.forEach((step) => {
        ctx.fillText(step, 170, stepY);
        stepY += 45;
      });

      ctx.fillStyle = "#ffffff";
      roundRect(ctx, 250, 700, 700, 620, 28);
      ctx.fill();

      ctx.strokeStyle = "#d4d4d8";
      ctx.lineWidth = 3;
      roundRect(ctx, 250, 700, 700, 620, 28);
      ctx.stroke();

      ctx.fillStyle = "#111111";
      ctx.textAlign = "center";
      ctx.font = "bold 30px Arial";
      ctx.fillText("Código QR del gimnasio", canvas.width / 2, 760);

      ctx.drawImage(qrImg, 360, 810, 480, 480);

      ctx.fillStyle = "#6b7280";
      ctx.font = "22px Arial";
      ctx.fillText(
        `Generado: ${new Date().toLocaleString("es-SV")}`,
        canvas.width / 2,
        1400
      );

      ctx.fillText(
        "Coloca este QR en recepción o en un lugar visible del local.",
        canvas.width / 2,
        1440
      );

      const imageUrl = canvas.toDataURL("image/png", 1);

      const cleanGymName = gymName
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "");

      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `qr-asistencia-${cleanGymName || "gimnasio"}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage("Imagen descargada correctamente");
    } catch (error) {
      console.error("Error descargando imagen:", error);
      setMessage("No se pudo descargar la imagen");
    } finally {
      setDownloadingImage(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            QR de asistencia
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Este QR pertenece al gimnasio:{" "}
            <span className="font-bold text-neutral-800">{gymName}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateQr}
            disabled={loading || downloadingImage}
            className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Generando..." : token ? "Regenerar QR" : "Generar QR"}
          </button>

          <button
            type="button"
            onClick={downloadQrImage}
            disabled={!token || !qrImage || loading || downloadingImage}
            className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-900 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloadingImage ? "Descargando..." : "Descargar imagen"}
          </button>
        </div>
      </div>

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

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed bg-neutral-50 p-5">
          {qrImage ? (
            <img
              src={qrImage}
              alt="QR de asistencia"
              className="h-72 w-72 rounded-xl bg-white p-3"
            />
          ) : (
            <p className="text-center text-sm text-neutral-500">
              Todavía no hay QR generado para este gimnasio.
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-neutral-50 p-5">
          <h3 className="font-bold text-neutral-900">Cómo funciona</h3>

          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">
            <p>
              1. El usuario escanea este QR desde el módulo de asistencia o con
              la cámara del celular.
            </p>

            <p>
              2. Si no tiene entrada registrada hoy, el sistema marca{" "}
              <strong>entrada</strong>.
            </p>

            <p>
              3. Si ya tiene entrada registrada hoy, el siguiente escaneo marca{" "}
              <strong>salida</strong>.
            </p>

            <p>
              4. Si ya marcó entrada y salida, el sistema no vuelve a registrar
              otra marca en la misma fecha.
            </p>
          </div>

          {qrUrl && (
            <div className="mt-5 rounded-xl bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
                URL del QR
              </p>

              <p className="mt-2 break-all text-xs text-neutral-600">{qrUrl}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}