import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gyms = await sql`
      select id, name, phone, email, address, status, created_at
      from gyms
      order by created_at desc
      limit 5
    `;

    return NextResponse.json({
      ok: true,
      message: "Conexión exitosa con Neon",
      data: gyms,
    });
  } catch (error) {
    console.error("Error al conectar con Neon:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error al conectar con Neon",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}