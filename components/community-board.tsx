import { formatDate } from "@/lib/labels";
import type { Announcement } from "@/lib/data/announcements";

/** Inicial del autor para el avatar (o "E" de Equip si no hay nombre). */
function authorInitial(name: string | null): string {
  const t = (name ?? "").trim();
  return t ? t[0].toUpperCase() : "E";
}

function Avatar({
  initial,
  size = "md",
}: {
  initial: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      aria-hidden
      className={
        size === "lg"
          ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-purple text-base font-bold text-white"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-purple text-sm font-bold text-white"
      }
    >
      {initial}
    </div>
  );
}

/**
 * Tauler de la comunitat (només lectura) amb més personalitat: la publicació
 * més recent destacada i la resta en targetes amb accent de marca i avatar
 * de l'autor.
 */
export function CommunityBoard({
  announcements,
}: {
  announcements: Announcement[];
}) {
  if (announcements.length === 0) {
    return (
      <p className="rounded-2xl border border-brand-border bg-white px-5 py-8 text-center text-sm text-brand-muted">
        Encara no hi ha publicacions.
      </p>
    );
  }

  const [featured, ...rest] = announcements;

  return (
    <div className="flex flex-col gap-6">
      {/* Destacat: la més recent */}
      <article className="overflow-hidden rounded-2xl border border-brand-purple/30 bg-gradient-to-br from-brand-purple/10 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-orange px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
            Novetat
          </span>
          <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            {formatDate(featured.createdAt)}
          </span>
        </div>
        <h2 className="mt-3 text-2xl text-brand-dark">{featured.title}</h2>
        <p className="mt-3 text-sm whitespace-pre-wrap text-brand-charcoal">
          {featured.body}
        </p>
        <div className="mt-4 flex items-center gap-2.5 border-t border-brand-purple/15 pt-4">
          <Avatar initial={authorInitial(featured.authorName)} size="lg" />
          <span className="text-sm font-bold text-brand-dark">
            {featured.authorName ?? "Equip VindiBCN"}
          </span>
        </div>
      </article>

      {/* Resta */}
      {rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.map((a) => (
            <article
              key={a.id}
              className="flex gap-3 rounded-2xl border border-brand-border bg-white p-5 transition-colors hover:border-brand-purple/40"
            >
              <div className="w-1 shrink-0 self-stretch rounded-full bg-brand-orange" />
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2.5">
                  <Avatar initial={authorInitial(a.authorName)} />
                  <div className="leading-tight">
                    <div className="text-sm font-bold text-brand-dark">
                      {a.authorName ?? "Equip"}
                    </div>
                    <div className="text-xs text-brand-muted">
                      {formatDate(a.createdAt)}
                    </div>
                  </div>
                </div>
                <h3 className="mt-3 text-lg text-brand-dark">{a.title}</h3>
                <p className="mt-1 text-sm whitespace-pre-wrap text-brand-charcoal">
                  {a.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
