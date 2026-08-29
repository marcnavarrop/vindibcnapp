/**
 * RUTA TEMPORAL DE PROVA — S'HA D'ESBORRAR EN ACABAR.
 *
 * Crida `createReservation`, el camí d'admin i professional, amb la sessió de
 * qui la crida. Serveix per llançar unes quantes reserves alhora contra la
 * mateixa franja de grup i comprovar que l'aforament es respecta també aquí.
 */
import { NextResponse } from "next/server";
import { createReservation } from "@/lib/data/reservations";

const SECRET = "3f9a1c7e-loadtest-2026-08-29-delete-me";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    secret?: string;
    bonoId?: string;
    trainerId?: string;
    scheduledAt?: string;
    repeatWeeks?: number;
  };
  if (body.secret !== SECRET)
    return NextResponse.json({ error: "no" }, { status: 403 });

  try {
    await createReservation(
      {
        bonoId: body.bonoId!,
        trainerId: body.trainerId ?? null,
        scheduledAt: body.scheduledAt!,
      },
      body.repeatWeeks ?? 1,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
