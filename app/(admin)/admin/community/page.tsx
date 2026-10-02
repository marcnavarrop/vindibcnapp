import Link from "next/link";
import { SectionTabsFrame, sectionTabClass } from "@/components/ui/section-tabs";
import { TAP } from "@/lib/utils";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { listAnnouncements } from "@/lib/data/announcements";
import { listPolls } from "@/lib/data/polls";
import { deleteAnnouncementAction } from "@/app/(admin)/admin/community/actions";
import { closePollAction, deletePollAction } from "@/app/(admin)/admin/community/polls/actions";
import { formatDate } from "@/lib/labels";
import { getCommunityDelivery, type CommunityDelivery } from "@/lib/notifications/community";

export const dynamic = "force-dynamic";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; correu?: string }>;
}) {
  const { tab, correu } = await searchParams;
  const activeTab = tab === "polls" ? "polls" : "announcements";

  const [announcements, polls] = await Promise.all([
    listAnnouncements(),
    listPolls(),
  ]);
  // Com ha anat el correu: només dels anuncis d'aquest últim mes (els vells
  // ja no interessen, i així els recomptes no creixen amb l'historial).
  const recent = announcements
    .filter((a) => Date.now() - Date.parse(a.createdAt) < 30 * 86_400_000)
    .map((a) => a.id);
  const delivery = await getCommunityDelivery(recent);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl text-brand-dark">Comunitat</h1>
        {activeTab === "announcements" ? (
          <Link
            href="/admin/community/new"
            className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            + Nova publicació
          </Link>
        ) : (
          <Link
            href="/admin/community/polls/new"
            className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            + Nova enquesta
          </Link>
        )}
      </div>

      {correu === "error" && (
        <p className="mb-6 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          L&apos;anunci s&apos;ha publicat, però no s&apos;ha pogut preparar el correu
          a la comunitat. No s&apos;ha enviat a ningú.
        </p>
      )}

      {/* Tabs */}
      {/* Anuncis i Enquestes són dues llistes diferents, no un filtre de la
          mateixa: van amb la forma de les pestanyes. */}
      <SectionTabsFrame label="Anuncis o enquestes">
        {([
          { key: "announcements", label: "Anuncis" },
          { key: "polls", label: "Enquestes" },
        ] as const).map(({ key, label }) => (
          <Link
            key={key}
            href={`/admin/community${key === "polls" ? "?tab=polls" : ""}`}
            aria-current={activeTab === key ? "page" : undefined}
            className={sectionTabClass(activeTab === key)}
          >
            {label}
            {key === "polls" && polls.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === key ? "bg-white/20 text-white" : "bg-brand-purple/20 text-brand-purple"}`}>
                {polls.length}
              </span>
            )}
          </Link>
        ))}
      </SectionTabsFrame>

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
                <DeliveryLine d={delivery.get(a.id)} createdAt={a.createdAt} />
                <div className="mt-3 flex items-center gap-4">
                  <Link
                    href={`/admin/community/${a.id}/edit`}
                    className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`}
                  >
                    Editar
                  </Link>
                  <ConfirmInline
                    compact
                    action={deleteAnnouncementAction}
                    fields={{ id: a.id }}
                    trigger="Eliminar"
                    triggerClassName={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error ${TAP}`}
                    question="Eliminar aquest anunci?"
                    consequence="Desapareix del tauler de clients i professionals. Els correus que ja s'hagin enviat no es poden retirar."
                    confirmLabel="Sí, elimina"
                    pendingLabel="Eliminant…"
                  />
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
                    className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`}
                  >
                    Veure resultats
                  </Link>
                  {p.active && (
                    <ConfirmInline
                      compact
                      action={closePollAction}
                      fields={{ id: p.id }}
                      trigger="Tancar"
                      triggerClassName={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error ${TAP}`}
                      question="Tancar aquesta enquesta?"
                      consequence="Ningú més hi podrà respondre, i no es pot tornar a obrir."
                      confirmLabel="Sí, tanca-la"
                      pendingLabel="Tancant…"
                    />
                  )}
                  <ConfirmInline
                    compact
                    action={deletePollAction}
                    fields={{ id: p.id }}
                    trigger="Eliminar"
                    triggerClassName={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error ${TAP}`}
                    question="Eliminar aquesta enquesta?"
                    consequence={
                      p.responseCount > 0
                        ? `S'esborren també ${p.responseCount === 1 ? "la resposta que té" : `les ${p.responseCount} respostes que té`}.`
                        : undefined
                    }
                    confirmLabel="Sí, elimina"
                    pendingLabel="Eliminant…"
                  />
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </main>
  );
}

/**
 * «Correu: enviat a 120 de 150». «Enviat» vol dir que Resend l'ha acceptat;
 * si després rebota, es veu a Resend, no aquí.
 */
function DeliveryLine({ d, createdAt }: { d?: CommunityDelivery; createdAt: string }) {
  if (!d || d.total === 0) return null;
  // Un enviament dura segons. Si al cap de 15 minuts encara en queden
  // d'apuntats, el procés es va aturar i ja no sortiran.
  const stuck = d.queued > 0 && Date.now() - Date.parse(createdAt) > 15 * 60_000;
  const bad = d.failed > 0 || stuck;
  return (
    <div
      data-testid="community-delivery"
      className={`mt-3 rounded-lg px-3 py-2 text-xs ${bad ? "bg-error/5 text-error" : "bg-brand-bg text-brand-muted"}`}
    >
      <p className="font-bold">
        Correu: enviat a {d.sent} de {d.total}
        {d.failed > 0 && ` · ${d.failed} fallit${d.failed !== 1 ? "s" : ""}`}
        {d.queued > 0 && (stuck ? ` · ${d.queued} sense enviar` : ` · enviant-ne ${d.queued}…`)}
      </p>
      {d.failed > 0 && d.firstError && (
        <p className="mt-0.5 break-words">Motiu: {d.firstError.split(" · ")[0].slice(0, 160)}</p>
      )}
      {stuck && <p className="mt-0.5">L&apos;enviament es va aturar abans d&apos;acabar.</p>}
    </div>
  );
}
