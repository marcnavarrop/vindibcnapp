import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listAnnouncements } from "@/lib/data/announcements";
import { listPollsForClient } from "@/lib/data/polls";
import { CommunityBoard } from "@/components/community-board";
import { PollCard } from "@/components/poll-card";

export const dynamic = "force-dynamic";

export default async function ClientComunitatPage() {
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;

  const [announcements, polls] = await Promise.all([
    listAnnouncements(),
    client ? listPollsForClient(client.id) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Comunitat</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Anuncis, novetats i enquestes del centre.
      </p>

      <div className="flex flex-col gap-6">
        {/* Enquestes: primer les actives sense respondre, després les restants */}
        {polls.length > 0 && (
          <section className="flex flex-col gap-4">
            {polls.map((p) => (
              <PollCard key={p.id} poll={p} />
            ))}
          </section>
        )}

        {/* Anuncis */}
        <CommunityBoard announcements={announcements} />
      </div>
    </main>
  );
}
