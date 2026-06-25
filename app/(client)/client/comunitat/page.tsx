import { listAnnouncements } from "@/lib/data/announcements";
import { CommunityBoard } from "@/components/community-board";

export const dynamic = "force-dynamic";

export default async function ClientComunitatPage() {
  const announcements = await listAnnouncements();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Comunitat</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Anuncis i novetats del centre.
      </p>
      <CommunityBoard announcements={announcements} />
    </main>
  );
}
