import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { exportClientData } from "@/lib/data/gdpr-export";
import { logDataAccess } from "@/lib/data/data-access-log";

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

  const { id } = await params;
  const result = await exportClientData(id);
  if (!result) {
    return NextResponse.json({ error: "Client no trobat." }, { status: 404 });
  }

  await logDataAccess({
    actorId: viewer.id,
    subjectProfileId: result.profileId,
    subjectLabel: result.label,
    action: "export",
  });

  const body = JSON.stringify(result.data, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vindibcn-client-${id}.json"`,
    },
  });
}
