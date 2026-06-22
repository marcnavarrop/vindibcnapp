import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { listAnnouncements } from "@/lib/data/announcements";
import { deleteAnnouncementAction } from "@/app/(admin)/admin/community/actions";
import { formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const announcements = await listAnnouncements();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl text-brand-dark">Comunitat</h1>
          <Link
            href="/admin/community/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nova publicació
          </Link>
        </div>

        {announcements.length === 0 ? (
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
        )}
      </main>
    </div>
  );
}
