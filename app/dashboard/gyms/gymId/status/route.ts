import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    gymId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          message: "No autenticado",
        },
        { status: 401 }
      );
    }

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          ok: false,
          message: "No autorizado",
        },
        { status: 403 }
      );
    }

    const { gymId } = await context.params;
    const body = await request.json();

    const action = String(body.action || "").toUpperCase();
    const accessDays = Number(body.accessDays || 30);

    if (!gymId) {
      return NextResponse.json(
        {
          ok: false,
          message: "ID del gimnasio requerido",
        },
        { status: 400 }
      );
    }

    const gymExists = await sql`
      select id, name, status
      from gyms
      where id = ${gymId}
      limit 1
    `;

    if (gymExists.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Gimnasio no encontrado",
        },
        { status: 404 }
      );
    }

    if (action === "SUSPEND") {
      await sql`
        update gyms
        set status = 'SUSPENDED',
            updated_at = now()
        where id = ${gymId}
      `;

      await sql`
        update system_subscriptions
        set status = 'SUSPENDED',
            updated_at = now()
        where gym_id = ${gymId}
      `;

      await sql`
        insert into audit_logs (
          gym_id,
          user_id,
          action,
          module,
          description
        )
        values (
          ${gymId},
          ${session.userId},
          'SUSPEND_GYM',
          'GYMS',
          'Se suspendió el acceso del gimnasio'
        )
      `;

      return NextResponse.json({
        ok: true,
        message: "Gimnasio suspendido correctamente",
      });
    }

    if (action === "ACTIVATE") {
      if (accessDays <= 0) {
        return NextResponse.json(
          {
            ok: false,
            message: "Los días de acceso deben ser mayores a 0",
          },
          { status: 400 }
        );
      }

      await sql`
        update gyms
        set status = 'ACTIVE',
            updated_at = now()
        where id = ${gymId}
      `;

      await sql`
        update system_subscriptions
        set status = 'ACTIVE',
            start_date = current_date,
            end_date = current_date + ${accessDays}::int,
            updated_at = now()
        where gym_id = ${gymId}
      `;

      await sql`
        insert into audit_logs (
          gym_id,
          user_id,
          action,
          module,
          description
        )
        values (
          ${gymId},
          ${session.userId},
          'ACTIVATE_GYM',
          'GYMS',
          ${"Se activó el gimnasio por " + accessDays + " días"}
        )
      `;

      return NextResponse.json({
        ok: true,
        message: "Gimnasio activado correctamente",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Acción no válida",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error actualizando estado del gimnasio:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error actualizando estado del gimnasio",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}