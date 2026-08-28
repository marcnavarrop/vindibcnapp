/**
 * RUTA TEMPORAL DE PROVA — S'HA D'ESBORRAR EN ACABAR.
 *
 * Fa la mateixa feina que el server action de reserva del client: llegeix qui
 * ets de la sessió i crida `createClientReservation`. Serveix per poder llançar
 * N reserves alhora contra una franja i comprovar l'aforament sota cursa.
 */
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createClientReservation } from "@/lib/data/reservations";

const SECRET = "3f9a1c7e-loadtest-2026-08-28-delete-me";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    secret?: string;
    trainerId?: string;
    serviceType?: string;
    scheduledAt?: string;
  };
  if (body.secret !== SECRET)
    return NextResponse.json({ error: "no" }, { status: 403 });

  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client")
    return NextResponse.json({ ok: false, error: "No autoritzat." });

  try {
    await createClientReservation({
      profileId: viewer.id,
      trainerId: body.trainerId!,
      serviceType: body.serviceType as never,
      scheduledAt: body.scheduledAt!,
    });
    return NextResponse.json({ ok: true, who: viewer.id });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      who: viewer.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
