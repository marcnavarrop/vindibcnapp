import { archivedDocumentResponse } from "@/lib/clinical-archive-document";

/** Un document de l'arxiu clínic: comprova qui el demana i el redirigeix (0119). */
export async function GET(_req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  return archivedDocumentResponse(entryId);
}
