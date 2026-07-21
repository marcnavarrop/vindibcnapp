import Link from "next/link";
import { listAnnouncements } from "@/lib/data/announcements";
import { listPolls } from "@/lib/data/polls";
import { deleteAnnouncementAction } from "@/app/(admin)/admin/community/actions";
import { closePollAction, deletePollAction } from "@/app/(admin)/admin/community/polls/actions";
import { formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "polls" ? "polls" : "announcements";

  const [announcements, polls] = await Promise.all([
    listAnnouncements(),
    listPolls(),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl text-brand-dark">Comunitat</h1>
        {activeTab === "announcements" ? (
          <Link
            href="/admin/community/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nova publicació
          </Link>
        ) : (
          <Link
            href="/admin/community/polls/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nova enquesta
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-lg border border-brand-border bg-white p-0.5">
        {([
          { key: "announcements", label: "Anuncis" },
          { key: "polls", label: "Enquestes" },
        ] as const).map(({ key, label }) => (
          <Link
            key={key}
            href={`/admin/community${key === "polls" ? "?tab=polls" : ""}`}
            className={`rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${
              activeTab === key
                ? "bg-brand-purple text-white"
                : "text-brand-muted hover:text-brand-dark"
            }`}
          >
            {label}
            {key === "polls" && polls.length > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-purple/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-purple">
                {polls.length}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Announcements tab */}
      {activeTab === "announcements" && (
        announcements.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-8 text-center text-sm text-brand-muted">
            Encara no hi ha publicacions.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {announcements.map((a) => (
              <article
                key={a.id}
                className="rounded-2xl border border-brand-border bg-white p-5"
              >
                <h2 className="text-lg text-brand-dark">{a.title}</h2>
                <p className="mt-1 text-xs font-bold tracking-wide text-brand-muted uppercase">
                  {a.authorName ?? "Equip"} · {formatDate(a.createdAt)}
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-brand-charcoal">
                  {a.body}
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <Link
                    href={`/admin/community/${a.id}/edit`}
                    className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                  >
                    Editar
                  </Link>
                  <form action={deleteAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {/* Polls tab */}
      {activeTab === "polls" && (
        polls.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white px-5 py-8 text-center text-sm text-brand-muted">
            Encara no hi ha enquestes.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {polls.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-brand-border bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        p.active
                          ? "bg-green-100 text-green-700"
                          : "bg-brand-bg text-brand-muted"
                      }`}
                    >
                      {p.active ? "Activa" : "Tancada"}
                    </span>
                    <h2 className="mt-2 text-lg text-brand-dark">{p.question}</h2>
                    <p className="mt-1 text-xs font-bold tracking-wide text-brand-muted uppercase">
                      {p.allowMultiple ? "Selecció múltiple" : "Opció única"} ·{" "}
                      {formatDate(p.createdAt)}
                      {p.closesAt && ` · Tanca ${formatDate(p.closesAt)}`}
                    </p>
                    <p className="mt-1 text-sm text-brand-muted">
                      {p.responseCount} resposta{p.responseCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <Link
                    href={`/admin/community/polls/${p.id}`}
                    className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                  >
                    Veure resultats
                  </Link>
                  {p.active && (
                    <form action={closePollAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
                      >
                        Tancar
                      </button>
                    </form>
                  )}
                  <form action={deletePollAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </main>
  );
}
