import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import {
  generateTemporaryPassword,
  getTemporaryPasswordExpiration,
} from "@/lib/credentials";
import { sendCredentialsEmail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const secret = request.headers.get("x-cron-secret");

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const users = await sql`
      select
        id,
        full_name,
        username,
        email
      from users
      where must_change_password = true
        and temp_password_expires_at is not null
        and temp_password_expires_at < now()
        and status = 'ACTIVE'
    `;

    let updated = 0;

    for (const user of users) {
      const temporaryPassword = generateTemporaryPassword();
      const expiresAt = getTemporaryPasswordExpiration();
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);

      await sql`
        update users
        set password_hash = ${passwordHash},
            temp_password_expires_at = ${expiresAt.toISOString()},
            credentials_email_sent_at = now(),
            updated_at = now()
        where id = ${user.id}
      `;

      await sendCredentialsEmail({
        to: user.email,
        fullName: user.full_name,
        username: user.username,
        temporaryPassword,
        expiresAt,
      });

      updated++;
    }

    return NextResponse.json({
      ok: true,
      message: "Contraseñas temporales actualizadas",
      updated,
    });
  } catch (error) {
    console.error("Error actualizando temporales:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error actualizando temporales",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}