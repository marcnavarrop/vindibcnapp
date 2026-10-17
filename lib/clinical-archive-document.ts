import "server-only";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getArchivedDocumentUrl } from "@/lib/data/clinical-archive";

/**
 * Obrir un document de l'arxiu clínic (0119): si qui el demana pot llegir la
 * fila amb la seva sessió, se l'envia a una URL signada de 10 minuts. La fan
 * servir les rutes de l'admin i del professional.
 */
export async function archivedDocumentResponse(entryId: string): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "No autoritzat." }, { status: 403 });
  const url = await getArchivedDocumentUrl(entryId, viewer);
  if (!url) return NextResponse.json({ error: "No trobat." }, { status: 404 });
  return NextResponse.redirect(url, 302);
}
