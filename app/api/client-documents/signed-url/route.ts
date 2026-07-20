import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { getDocumentSignedUrl } from "@/lib/data/client-documents";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";

/**
 * GET /api/client-documents/signed-url?id=<documentId>
 *
 * Genera una signed URL de curta durada per descarregar un document.
 * Accessible per: el propi client, el trainer assignat i l'admin.
 */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "No autenticat." }, { status: 401 });

  const documentId = req.nextUrl.searchParams.get("id");
  if (!documentId) return NextResponse.json({ error: "Paràmetre id absent." }, { status: 400 });

  // Resolem el clientId associat al document (sense exposar-lo al client).
  let clientId: string | null = null;

  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const doc = getStore().client_documents.find((d) => d.id === documentId);
    clientId = doc?.client_id ?? null;
  } else {
    const admin = createAdminClient();
    const { data } = await admin
      .from("client_documents")
      .select("client_id")
      .eq("id", documentId)
      .single();
    clientId = data?.client_id ?? null;
  }

  if (!clientId) return NextResponse.json({ error: "Document no trobat." }, { status: 404 });

  // Comprova que el viewer té accés: és el propi client, el trainer assignat o admin.
  if (viewer.role !== "admin") {
    if (viewer.role === "client") {
      const client = await getClientByProfile(viewer.id);
      if (client?.id !== clientId)
        return NextResponse.json({ error: "Accés denegat." }, { status: 403 });
    } else {
      // Trainer: comprova que té el client assignat.
      if (!USE_MOCK) {
        const admin = createAdminClient();
        const { data: c } = await admin
          .from("clients")
          .select("assigned_trainer_id")
          .eq("id", clientId)
          .single();
        if (c?.assigned_trainer_id !== viewer.id)
          return NextResponse.json({ error: "Accés denegat." }, { status: 403 });
      }
    }
  }

  try {
    const url = await getDocumentSignedUrl(documentId, clientId);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error intern." },
      { status: 500 },
    );
  }
}
