"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { TAP, clsx } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SERVICE_LABELS, SERVICE_TYPES, BONO_STATUS_LABELS, formatEur, formatDate } from "@/lib/labels";
import {
  markTrainerBonoPaidAction,
  cancelTrainerBonoAction,
} from "@/app/(trainer)/trainer/bonos/actions";
import { MarkBonoPaidButton } from "@/components/forms/mark-bono-paid-button";
import { CancelBonoButton } from "@/components/forms/cancel-bono-button";
import { CollectableBonosAnnouncer } from "@/components/collectable-bonos-announcer";
import { cancelBlockFor } from "@/lib/bono-rules";
import type { BonoFilter, BonoListItem } from "@/lib/data/bonos";
import { LoadMoreFooter, useLoadMore, useUrlQuery } from "@/components/server-list";
import { loadMoreBonosAction } from "@/app/actions/bono-list-actions";
import type { BonoStatus, ServiceType } from "@/types/database";

/**
 * Els bons del centre, vistos pel professional.
 *
 * PER QUÈ NO ÉS LA TAULA DE L'ADMIN AMB UN INTERRUPTOR
 *
 * Són dues taules perquè responen dues preguntes diferents. L'admin veu el
 * centre sencer i pot anul·lar-ho tot, també el que ja s'ha cobrat; el
 * professional veu el centre sencer, pot cobrar-hi qualsevol bo (0085) però
 * només anul·lar els que ningú ha pagat. Encabir-les en un sol component
 * demanaria una bandera per cada diferència —el conmutador "Els meus", quines
 * files porten quin botó, el text de la capçalera— i el resultat seria pitjor
 * de llegir que les dues per separat.
 *
 * El que SÍ que es comparteix és el que havia d'estar compartit: els dos botons
 * amb els seus diàlegs (`MarkBonoPaidButton`, `CancelBonoButton`) i la regla
 * d'anul·lació (`cancelBlockFor`), que també fa servir el servidor. El dia que
 * canviï què fan, les tres pantalles ho diran igual.
 *
 * ELS FILTRES SÓN DE LA CASA, I VAN AL SERVIDOR
 *
 * El conmutador "Els meus / Tots" és el mateix de `TrainerClientsTable` i el
 * filtre per estat és el de `BonosAdminTable`. Es comença per "Els meus"
 * perquè és la feina pròpia; el centre sencer és a un clic.
 *
 * Tots van a l'adreça i els fa la base (`listBonosPage`): estat, «Els meus»,
 * el nom del client i el servei. La llista va per pàgines i els comptadors
 * són els de TOT el centre (`countCollectableByStatus`, la piloteta). Abans es
 * portaven tots els bons del centre i es filtrava aquí. La cerca de text era
 * per client O servei; a la base, el nom és dos nivells més avall i no es pot
 * barrejar amb el servei en una sola condició: el servei és un desplegable.
 */

const STATUS_TONE: Record<
  BonoStatus,
  "success" | "neutral" | "danger" | "warn"
> = {
  active: "success",
  completed: "neutral",
  cancelled: "danger",
  pending_payment: "warn",
  // Mateix criteri que a l'admin: caducat i anul·lat no són neutrals com
  // "completat", perquè hi ha sessions pagades que s'han perdut.
  expired: "danger",
  unpaid: "danger",
};

const FILTERS: { key: BonoFilter; label: string }[] = [
  { key: "all", label: "Tots" },
  { key: "pending_payment", label: "Pendents de pagament" },
  { key: "unpaid", label: "Decaiguts sense cobrar" },
  { key: "active", label: "Actius" },
];

type View = {
  scope: "mine" | "all";
  filter: BonoFilter;
  q: string;
  serviceType: ServiceType | null;
};

export function TrainerBonosTable({
  initialRows,
  initialCursor,
  total,
  view,
  counts,
  today,
}: {
  initialRows: BonoListItem[];
  initialCursor: string | null;
  total: number | null;
  /** Els filtres amb què el servidor ha pintat aquesta pàgina. */
  view: View;
  /** Tot el centre (la piloteta), no només «Els meus». */
  counts: { pending_payment: number; unpaid: number };
  /** Dia del CENTRE. Ve del servidor: el navegador pot anar en una altra zona. */
  today: string;
}) {
  const search = useUrlQuery();
  const router = useRouter();
  const pathname = usePathname();
  const [switching, startSwitch] = useTransition();
  const href = (next: Partial<View>) => {
    const v = { ...view, ...next };
    const p = new URLSearchParams();
    if (v.scope === "all") p.set("tots", "1");
    if (v.filter !== "all") p.set("estat", v.filter);
    if (v.serviceType) p.set("servei", v.serviceType);
    if (v.q) p.set("q", v.q);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const pill = (active: boolean) =>
    clsx(
      "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
      active ? "bg-brand-purple text-white" : "text-brand-muted hover:text-brand-dark",
      TAP,
    );

  return (
    <div>
      {/* La piloteta del menú es posa al dia amb aquests comptadors, en entrar
          i cada cop que un cobrament o una anul·lació repinta la pàgina. */}
      <CollectableBonosAnnouncer count={counts.pending_payment + counts.unpaid} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <nav aria-label="Quins bons" className="inline-flex rounded-lg border border-brand-border bg-white p-0.5">
          {(["mine", "all"] as const).map((s) => (
            <Link
              key={s}
              href={href({ scope: s })}
              replace
              scroll={false}
              aria-current={view.scope === s ? "page" : undefined}
              className={pill(view.scope === s)}
            >
              {s === "mine" ? "Els meus" : "Tots"}
            </Link>
          ))}
        </nav>
        <input
          type="search"
          value={search.value}
          onChange={(e) => search.setValue(e.target.value)}
          placeholder="Cerca per client…"
          aria-label="Cerca bons per client"
          className="w-full max-w-sm rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        />
        <label className="flex items-center gap-2 text-sm text-brand-muted">
          <span className="whitespace-nowrap">Servei</span>
          <select
            value={view.serviceType ?? ""}
            onChange={(e) =>
              startSwitch(() =>
                router.replace(href({ serviceType: (e.target.value || null) as ServiceType | null }), {
                  scroll: false,
                }),
              )
            }
            className="min-h-11 rounded-lg border border-brand-border bg-white px-3 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
          >
            <option value="">Tots</option>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SERVICE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {(search.pending || switching) && (
          <span className="text-sm text-brand-muted" aria-live="polite">
            Buscant…
          </span>
        )}
      </div>

      <nav aria-label="Filtre d'estat" className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-brand-border bg-white p-0.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href({ filter: f.key })}
            replace
            scroll={false}
            aria-current={view.filter === f.key ? "page" : undefined}
            className={pill(view.filter === f.key)}
          >
            {f.label}
            {(f.key === "pending_payment" || f.key === "unpaid") &&
              counts[f.key] > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-orange px-1.5 text-[10px] text-white">
                  {counts[f.key]}
                </span>
              )}
          </Link>
        ))}
      </nav>

      <TrainerBonosRows
        key={`${view.scope}|${view.filter}|${view.serviceType ?? ""}|${view.q}`}
        initialRows={initialRows}
        initialCursor={initialCursor}
        total={total}
        view={view}
        today={today}
        dim={search.pending || switching}
      />
    </div>
  );
}

function TrainerBonosRows({
  initialRows,
  initialCursor,
  total,
  view,
  today,
  dim,
}: {
  initialRows: BonoListItem[];
  initialCursor: string | null;
  total: number | null;
  view: View;
  today: string;
  dim: boolean;
}) {
  const list = useLoadMore(initialRows, initialCursor, (cursor) =>
    loadMoreBonosAction(
      { filter: view.filter, q: view.q, serviceType: view.serviceType, scope: view.scope },
      cursor,
    ),
  );

  /**
   * Cobrar ja no depèn de qui tingui el client assignat (0085): qui té la
   * persona al davant amb els diners no sempre és qui la té assignada. La RLS
   * ho torna a mirar amb `bonos_trainer_collect_any`.
   */
  const canCollect = (b: BonoListItem) =>
    b.status === "pending_payment" || b.status === "unpaid";

  /**
   * Anul·lar sí que té sostre: `false` és l'`isAdmin`. Un bo ja cobrat li
   * reboteja al professional —deixar diners al llibre sense res que ho
   * compensi és una esmena comptable—, i la regla sencera viu a
   * `cancelBlockFor`, compartida amb el servidor.
   */
  const canCancel = (b: BonoListItem) =>
    cancelBlockFor(
      {
        status: b.status,
        remainingSessions: b.remainingSessions,
        totalSessions: b.totalSessions,
        subscriptionId: b.subscriptionId,
      },
      false,
    ) === null;

  return (
    <>
      <div
        className={clsx(
          "overflow-x-auto rounded-2xl border border-brand-border bg-white transition-opacity",
          dim && "opacity-60",
        )}
      >
        <table className="w-full min-w-[44rem] text-left text-sm" data-testid="bonos-table">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Servei</th>
              <th className="px-4 py-3 font-bold">Sessions</th>
              <th className="px-4 py-3 font-bold">Preu</th>
              <th className="px-4 py-3 font-bold">Caduca</th>
              <th className="px-4 py-3 font-bold">Estat</th>
              <th className="px-4 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((b) => (
              <tr
                key={b.id}
                className="border-b border-brand-border last:border-0"
              >
                <td className="px-4 py-3 font-bold text-brand-dark">
                  {b.clientName}
                </td>
                <td className="px-4 py-3">{SERVICE_LABELS[b.serviceType]}</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-brand-purple">
                    {b.remainingSessions}
                  </span>
                  <span className="text-brand-muted"> / {b.totalSessions}</span>
                  {b.status === "pending_payment" &&
                    b.totalSessions - b.remainingSessions > 0 && (
                      <span className="ml-2 text-xs font-bold text-brand-orange">
                        ({b.totalSessions - b.remainingSessions} ja consumides)
                      </span>
                    )}
                </td>
                <td className="px-4 py-3">{formatEur(b.price)}</td>
                <td className="px-4 py-3 text-brand-muted">
                  {b.expiresAt ? formatDate(b.expiresAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[b.status]}>
                    {BONO_STATUS_LABELS[b.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {/*
                    Botons en línia i no un menú de tres punts: hi ha com a molt
                    dues accions i gairebé mai totes dues. Amagar una sola opció
                    darrere d'un desplegable són més clics, no menys —i un
                    desplegable dins d'un `overflow-x-auto` s'hi retalla.

                    A les files sense cap acció es deixa el buit i prou. Un botó
                    apagat convidaria a insistir-hi.
                  */}
                  <div className="flex justify-end gap-2">
                    {canCollect(b) && (
                      <MarkBonoPaidButton
                        action={markTrainerBonoPaidAction}
                        bonoId={b.id}
                        clientName={b.clientName}
                        serviceType={b.serviceType}
                        price={b.price}
                        remainingSessions={b.remainingSessions}
                        totalSessions={b.totalSessions}
                        status={b.status}
                        expired={!!b.expiresAt && b.expiresAt < today}
                      />
                    )}
                    {canCancel(b) && (
                      <CancelBonoButton
                        action={cancelTrainerBonoAction}
                        bonoId={b.id}
                        clientName={b.clientName}
                        serviceType={b.serviceType}
                        price={b.price}
                        totalSessions={b.totalSessions}
                        status={b.status}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {list.items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-brand-muted"
                >
                  {view.scope === "mine"
                    ? "Cap bo teu en aquest filtre. Prova amb «Tots»."
                    : "Sense bons en aquest filtre."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <LoadMoreFooter
        shown={list.items.length}
        total={total}
        noun="bons"
        hasMore={list.hasMore}
        pending={list.pending}
        error={list.error}
        onLoadMore={list.loadMore}
      />
    </>
  );
}
