import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const gymId = cleanString(body.gymId);
    const status = cleanString(body.status).toUpperCase();
    const accessDays = Math.max(1, Math.trunc(cleanNumber(body.accessDays || 30)));

    if (!gymId) {
      return NextResponse.json(
        { ok: false, message: "Falta el ID del gimnasio" },
        { status: 400 }
      );
    }

    if (!["ACTIVE", "SUSPENDED"].includes(status)) {
      return NextResponse.json(
        { ok: false, message: "Estado no válido" },
        { status: 400 }
      );
    }

    const gym = await sql`
      select id
      from gyms
      where id = ${gymId}
      limit 1
    `;

    if (gym.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Gimnasio no encontrado" },
        { status: 404 }
      );
    }

    if (status === "ACTIVE") {
      await sql`
        update gyms
        set
          status = 'ACTIVE',
          updated_at = now()
        where id = ${gymId}
      `;

      const subscription = await sql`
        select id
        from system_subscriptions
        where gym_id = ${gymId}
        limit 1
      `;

      if (subscription.length === 0) {
        await sql`
          insert into system_subscriptions (
            gym_id,
            plan_name,
            monthly_fee,
            start_date,
            end_date,
            status,
            created_at,
            updated_at
          )
          values (
            ${gymId},
            'Plan Mensual',
            0,
            current_date,
            current_date + (${accessDays})::integer,
            'ACTIVE',
            now(),
            now()
          )
        `;
      } else {
        await sql`
          update system_subscriptions
          set
            start_date = current_date,
            end_date = current_date + (${accessDays})::integer,
            status = 'ACTIVE',
            updated_at = now()
          where gym_id = ${gymId}
        `;
      }

      return NextResponse.json({
        ok: true,
        message: `Gimnasio activado por ${accessDays} días`,
      });
    }

    await sql`
      update gyms
      set
        status = 'SUSPENDED',
        updated_at = now()
      where id = ${gymId}
    `;

    await sql`
      update system_subscriptions
      set
        status = 'SUSPENDED',
        updated_at = now()
      where gym_id = ${gymId}
    `;

    return NextResponse.json({
      ok: true,
      message: "Gimnasio suspendido correctamente",
    });
  } catch (error) {
    console.error("Error actualizando estado del gimnasio:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error actualizando estado: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}