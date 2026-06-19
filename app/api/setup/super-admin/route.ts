import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const setupSecret = process.env.SETUP_SECRET;
    const receivedSecret = request.headers.get("x-setup-secret");

    if (!setupSecret || receivedSecret !== setupSecret) {
      return NextResponse.json(
        {
          ok: false,
          message: "No autorizado",
        },
        { status: 403 }
      );
    }

    const existingSuperAdmin = await sql`
      select id from users
      where role = 'SUPER_ADMIN'
      limit 1
    `;

    if (existingSuperAdmin.length > 0) {
      return NextResponse.json({
        ok: false,
        message: "Ya existe un SUPER_ADMIN en el sistema",
      });
    }

    const username = "admin";
    const email = "admin@gym-saas.com";
    const password = "Admin123456";
    const fullName = "Super Admin";

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await sql`
      insert into users (
        full_name,
        username,
        email,
        password_hash,
        role,
        status
      )
      values (
        ${fullName},
        ${username},
        ${email},
        ${passwordHash},
        'SUPER_ADMIN',
        'ACTIVE'
      )
      returning id, full_name, username, email, role, status, created_at
    `;

    return NextResponse.json({
      ok: true,
      message: "SUPER_ADMIN creado correctamente",
      user: user[0],
      credentials: {
        username,
        password,
      },
    });
  } catch (error) {
    console.error("Error creando SUPER_ADMIN:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error creando SUPER_ADMIN",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}