import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getArchivedPatient } from "@/lib/data/clinical-archive";
import { PRE_BLOCKED_MESSAGE, preModeBlocksPersonalData } from "@/lib/pre-mode";

/**
 * L'arxiu clínic d'un pacient, per lliurar-l'hi si exerceix el dret d'accés
 * (0119). Només l'admin. Queda al registre com a `clinical_archive_export`.
 * Els documents hi surten amb les seves dades; el fitxer es descarrega des de
 * la fitxa.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin")
    return NextResponse.json({ error: "No autoritzat." }, { status: 403 });
  // El mateix fre que l'exportació de dades del client: amb el mode PRE armat,
  // el registre diria que ho ha exportat un compte demo. Vegeu lib/pre-mode.ts.
  if (await preModeBlocksPersonalData())
    return NextResponse.json({ error: PRE_BLOCKED_MESSAGE }, { status: 409 });

  const { id } = await params;
  const p = await getArchivedPatient(id, viewer, "export");
  if (!p) return NextResponse.json({ error: "No trobat." }, { status: 404 });

  const body = {
    exported_at: new Date().toISOString(),
    legal_basis: "Llei 21/2000, art. 12 · RGPD art. 15 i 17.3.b",
    patient: {
      full_name: p.fullName,
      birth_date: p.birthDate,
      email: p.email,
      phone: p.phone,
      last_care_on: p.lastCareOn,
      archived_at: p.archivedAt,
      kept_until: p.purgeAfter,
    },
    entries: p.entryList.map((e) => ({
      kind: e.kind,
      written_at: e.writtenAt,
      updated_at: e.updatedAt,
      session_on: e.sessionOn,
      author: e.authorName,
      body: e.body,
      document: e.kind === "document" ? { file_name: e.fileName, size: e.fileSize, type: e.mimeType, description: e.description } : undefined,
      consent: e.kind === "consent" ? { version: e.consentVersion, revoked_at: e.consentRevokedAt } : undefined,
      kept_until: e.purgeAfter,
    })),
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vindibcn-arxiu-clinic-${id}.json"`,
    },
  });
}
