import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getExerciseVideoSignedUrl } from "@/lib/data/exercise-videos";

/**
 * GET /api/exercise-videos/signed-url?path=<storagePath>
 * Genera una signed URL per reproduir/descarregar el vídeo d'un exercici.
 * Accessible per qualsevol usuari autenticat (el vídeo és de la biblioteca).
 */
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer)
    return NextResponse.json({ error: "No autenticat." }, { status: 401 });

  const storagePath = req.nextUrl.searchParams.get("path");
  if (!storagePath)
    return NextResponse.json({ error: "Paràmetre path absent." }, { status: 400 });

  try {
    const url = await getExerciseVideoSignedUrl(storagePath);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error intern." },
      { status: 500 },
    );
  }
}
