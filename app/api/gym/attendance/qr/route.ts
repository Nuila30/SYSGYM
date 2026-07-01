import crypto from "crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session || !session.gymId) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (session.role !== "GYM_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const token = await sql`
      select
        id,
        gym_id,
        token,
        is_active,
        created_at
      from gym_qr_tokens
      where gym_id = ${session.gymId}
        and is_active = true
      order by created_at desc
      limit 1
    `;

    return NextResponse.json({
      ok: true,
      token: token[0] || null,
    });
  } catch (error) {
    console.error("Error obteniendo QR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error obteniendo QR",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await getCurrentSession();

    if (!session || !session.gymId) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    if (session.role !== "GYM_ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          message: "Solo el administrador del gimnasio puede generar el QR",
        },
        { status: 403 }
      );
    }

    await sql`
      update gym_qr_tokens
      set is_active = false
      where gym_id = ${session.gymId}
        and is_active = true
    `;

    const newToken = generateToken();

    const token = await sql`
      insert into gym_qr_tokens (
        gym_id,
        token,
        is_active,
        created_by
      )
      values (
        ${session.gymId},
        ${newToken},
        true,
        ${session.userId}
      )
      returning
        id,
        gym_id,
        token,
        is_active,
        created_at
    `;

    return NextResponse.json({
      ok: true,
      message: "QR generado correctamente",
      token: token[0],
    });
  } catch (error) {
    console.error("Error generando QR:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error generando QR",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}