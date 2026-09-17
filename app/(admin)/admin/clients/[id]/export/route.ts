import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { exportClientData } from "@/lib/data/gdpr-export";
import { logDataAccess } from "@/lib/data/data-access-log";
import {
  PRE_BLOCKED_MESSAGE,
  preModeBlocksPersonalData,
} from "@/lib/pre-mode";

/**
 * Descàrrega de totes les dades personals d'un client (dret d'accés i
 * portabilitat, RGPD). Només admin. Deixa constància al data_access_log.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") {
    return NextResponse.json({ error: "No autoritzat." }, { status: 403 });
  }

  // El fre del mode PRE. Va DESPRÉS del rol i ABANS de llegir res: amb un mode
  // de proves armat, `data_access_log` pot acabar dient que qui va exportar era
  // un compte demo, i aquest registre és la prova de compliment. Vegeu
  // lib/pre-mode.ts.
  if (await preModeBlocksPersonalData()) {
    return NextResponse.json({ error: PRE_BLOCKED_MESSAGE }, { status: 409 });
  }

  const { id } = await params;
  const result = await exportClientData(id);
  if (!result) {
    return NextResponse.json({ error: "Client no trobat." }, { status: 404 });
  }

  try {
    await logDataAccess({
      actorId: viewer.id,
      subjectProfileId: result.profileId,
      subjectLabel: result.label,
      action: "export",
    });
  } catch {
    // El registre és best-effort: no bloquegem el dret d'accés si falla.
  }

  const body = JSON.stringify(result.data, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vindibcn-client-${id}.json"`,
    },
  });
}
