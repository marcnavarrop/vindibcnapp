import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listClientVideos } from "@/lib/data/client-videos";
import { VideosReadonlyPanel } from "@/components/videos-readonly-panel";

export const dynamic = "force-dynamic";

export default async function ClientVideosPage() {
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const videos = client ? await listClientVideos(client.id) : [];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Vídeos</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Vídeos que el teu professional ha pujat per a tu. Pots reproduir-los o
        descarregar-los.
      </p>
      {client ? (
        <VideosReadonlyPanel videos={videos} />
      ) : (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no tens fitxa de client.
        </p>
      )}
    </main>
  );
}
