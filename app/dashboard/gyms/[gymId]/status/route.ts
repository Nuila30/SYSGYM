import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { cleanString, isValidUuid, type FieldErrors } from "@/lib/validacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    gymId: string;
  }>;
};

type GymStatus = "ACTIVE" | "SUSPENDED";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function validationResponse(errors: FieldErrors) {
  return NextResponse.json(
    {
      ok: false,
      message: "Hay campos inválidos",
      errors,
    },
    { status: 400 }
  );
}

function normalizeStatus(value: unknown): GymStatus | "" {
  const status = cleanString(value).toUpperCase();

  if (["ACTIVE", "SUSPENDED"].includes(status)) {
    return status as GymStatus;
  }

  return "";
}

async function requireSuperAdmin() {
  const session = await getCurrentSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return null;
  }

  return session;
}

function validatePayload(gymId: string, body: any) {
  const status = normalizeStatus(body.status);

  const errors: FieldErrors = {};

  if (!gymId) {
    errors.gymId = "Falta el ID del gimnasio";
  } else if (!isValidUuid(gymId)) {
    errors.gymId = "ID de gimnasio inválido";
  }

  if (!status) {
    errors.status = "Estado inválido";
  }

  return {
    ok: Object.keys(errors).length === 0,
    data: {
      gymId,
      status,
    },
    errors,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireSuperAdmin();

    if (!session) {
      return NextResponse.json(
        { ok: false, message: "No autorizado" },
        { status: 403 }
      );
    }

    const { gymId } = await context.params;
    const body = await request.json();

    const validation = validatePayload(gymId, body);

    if (!validation.ok) {
      return validationResponse(validation.errors);
    }

    const { status } = validation.data;

    const gym = await sql`
      select id, status
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

    await sql`
      update gyms
      set
        status = ${status},
        updated_at = now()
      where id = ${gymId}
    `;

    if (status === "ACTIVE") {
      const subscription = await sql`
        select
          ss.id,
          coalesce(ss.access_days, sp.access_days, 30) as access_days
        from system_subscriptions ss
        left join system_plans sp on sp.id = ss.system_plan_id
        where ss.gym_id = ${gymId}
        order by ss.created_at desc
        limit 1
      `;

      if (subscription.length > 0) {
        const accessDays = Math.max(
          1,
          Math.trunc(Number(subscription[0].access_days || 30))
        );

        await sql`
          update system_subscriptions
          set
            status = 'ACTIVE',
            start_date = current_date,
            end_date = current_date + (${accessDays})::integer,
            updated_at = now()
          where id = ${subscription[0].id}
        `;
      }
    }

    if (status === "SUSPENDED") {
      await sql`
        update system_subscriptions
        set
          status = 'SUSPENDED',
          updated_at = now()
        where gym_id = ${gymId}
      `;
    }

    return NextResponse.json({
      ok: true,
      message:
        status === "ACTIVE"
          ? "Gimnasio activado correctamente"
          : "Gimnasio suspendido correctamente",
    });
  } catch (error) {
    console.error("Error actualizando estado del gimnasio:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          "Error actualizando estado del gimnasio: " + getErrorMessage(error),
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}