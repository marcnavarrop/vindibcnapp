import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { getVideoSignedUrl } from "@/lib/data/client-videos";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";

/**
 * GET /api/client-videos/signed-url?id=<videoId>
 *
 * Genera una signed URL de curta durada per reproduir/descarregar un vídeo.
 * Accessible per: el propi client (lectura), trainer assignat i admin.
 */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "No autenticat." }, { status: 401 });

  const videoId = req.nextUrl.searchParams.get("id");
  if (!videoId) return NextResponse.json({ error: "Paràmetre id absent." }, { status: 400 });

  let clientId: string | null = null;

  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    const v = (getStore().client_videos ?? []).find((x) => x.id === videoId);
    clientId = v?.client_id ?? null;
  } else {
    const admin = createAdminClient();
    const { data } = await admin
      .from("client_videos")
      .select("client_id")
      .eq("id", videoId)
      .single();
    clientId = data?.client_id ?? null;
  }

  if (!clientId) return NextResponse.json({ error: "Vídeo no trobat." }, { status: 404 });

  if (viewer.role !== "admin") {
    if (viewer.role === "client") {
      const client = await getClientByProfile(viewer.id);
      if (client?.id !== clientId)
        return NextResponse.json({ error: "Accés denegat." }, { status: 403 });
    } else {
      // Trainer
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
    const url = await getVideoSignedUrl(videoId);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error intern." },
      { status: 500 },
    );
  }
}
