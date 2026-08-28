/**
 * RUTA TEMPORAL DE PROVA — S'HA D'ESBORRAR EN ACABAR.
 *
 * Existeix només per disparar N reserves alhora contra producció i veure si
 * l'aforament d'un grup aguanta la concurrència. Crida EXACTAMENT la mateixa
 * funció que el server action del client (`createClientReservation`) amb els
 * mateixos arguments: l'única cosa que no passa pel mig és `getViewer()`, que
 * no té res a veure amb la cursa que es vol mesurar.
 *
 * Va tancada amb un secret d'un sol ús. No s'ha de quedar desplegada.
 */
import { NextResponse } from "next/server";
import { createClientReservation } from "@/lib/data/reservations";

const SECRET = "3f9a1c7e-loadtest-2026-08-28-delete-me";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    secret?: string;
    profileId?: string;
    trainerId?: string;
    serviceType?: string;
    scheduledAt?: string;
  };
  if (body.secret !== SECRET)
    return NextResponse.json({ error: "no" }, { status: 403 });

  try {
    await createClientReservation({
      profileId: body.profileId!,
      trainerId: body.trainerId!,
      serviceType: body.serviceType as never,
      scheduledAt: body.scheduledAt!,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
