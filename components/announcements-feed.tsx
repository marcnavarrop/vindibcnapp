import { formatDate } from "@/lib/labels";
import type { Announcement } from "@/lib/data/announcements";

/** Llistat de publicacions de la comunitat (només lectura). */
export function AnnouncementsFeed({
  announcements,
}: {
  announcements: Announcement[];
}) {
  if (announcements.length === 0) {
    return (
      <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
        Encara no hi ha publicacions.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {announcements.map((a) => (
        <article
          key={a.id}
          className="rounded-2xl border border-brand-border bg-white p-5"
        >
          <h3 className="text-lg text-brand-dark">{a.title}</h3>
          <p className="mt-1 text-xs font-bold tracking-wide text-brand-muted uppercase">
            {a.authorName ?? "Equip"} · {formatDate(a.createdAt)}
          </p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-brand-charcoal">
            {a.body}
          </p>
        </article>
      ))}
    </div>
  );
}
