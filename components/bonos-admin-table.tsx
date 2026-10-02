"use client";

import { FilterChips, filterChipClass, ChipCheck } from "@/components/ui/filter-chips";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SERVICE_LABELS, BONO_STATUS_LABELS, formatEur, formatDate } from "@/lib/labels";
import { markBonoPaidAction, cancelBonoAction } from "@/app/(admin)/admin/bonos/actions";
import { MarkBonoPaidButton } from "@/components/forms/mark-bono-paid-button";
import { CancelBonoButton } from "@/components/forms/cancel-bono-button";
import { CollectableBonosAnnouncer } from "@/components/collectable-bonos-announcer";
import { cancelBlockFor } from "@/lib/bono-rules";
import type { BonoFilter, BonoListItem } from "@/lib/data/bonos";
import { LoadMoreFooter, useLoadMore } from "@/components/server-list";
import { loadMoreBonosAction } from "@/app/actions/bono-list-actions";
import type { BonoStatus } from "@/types/database";

const STATUS_TONE: Record<
  BonoStatus,
  "success" | "neutral" | "danger" | "warn"
> = {
  active: "success",
  completed: "neutral",
  cancelled: "danger",
  pending_payment: "warn",
  // Caducat NO és neutral com "completat": s'han perdut sessions pagades.
  expired: "danger",
  // Anul·lat per impagament: també és pèrdua, i l'etiqueta n'explica el motiu.
  unpaid: "danger",
};

const FILTERS: { key: BonoFilter; label: string }[] = [
  { key: "all", label: "Tots" },
  { key: "pending_payment", label: "Pendents de pagament" },
  { key: "unpaid", label: "Decaiguts sense cobrar" },
  { key: "active", label: "Actius" },
];

/**
 * La llista de bons de l'admin, per pàgines.
 *
 * El filtre va a l'adreça (`?estat=`) i es fa a la base (`listBonosPage`); els
 * comptadors dels filtres arriben del servidor (`countCollectableByStatus`),
 * amb el mateix criteri que la piloteta del menú. Abans es portaven tots els
 * bons i es comptava i filtrava aquí, i amb més de 1000 tot quedava curt.
 */
export function BonosAdminTable({
  initialRows,
  initialCursor,
  total,
  filter,
  counts,
  today,
}: {
  initialRows: BonoListItem[];
  initialCursor: string | null;
  total: number | null;
  filter: BonoFilter;
  /** Tot el centre, no la pàgina carregada: la cua és la del centre. */
  counts: { pending_payment: number; unpaid: number };
  /** Dia del CENTRE. Ve del servidor: el navegador pot anar en una altra zona. */
  today: string;
}) {
  return (
    <div>
      {/* La piloteta del menú es posa al dia amb aquests comptadors, en entrar
          i cada cop que un cobrament o una anul·lació repinta la pàgina. */}
      <CollectableBonosAnnouncer count={counts.pending_payment + counts.unpaid} />
      <FilterChips label="Filtre d'estat">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/bonos" : `/admin/bonos?estat=${f.key}`}
            replace
            scroll={false}
            aria-current={filter === f.key ? "page" : undefined}
            className={filterChipClass(filter === f.key)}
          >
            <ChipCheck on={filter === f.key} />
            {f.label}
            {(f.key === "pending_payment" || f.key === "unpaid") &&
              counts[f.key] > 0 && (
                <span className="rounded-full bg-brand-orange px-1.5 text-[10px] text-white">
                  {counts[f.key]}
                </span>
              )}
          </Link>
        ))}
      </FilterChips>

      <BonosAdminRows
        key={filter}
        initialRows={initialRows}
        initialCursor={initialCursor}
        total={total}
        filter={filter}
        today={today}
      />
    </div>
  );
}

function BonosAdminRows({
  initialRows,
  initialCursor,
  total,
  filter,
  today,
}: {
  initialRows: BonoListItem[];
  initialCursor: string | null;
  total: number | null;
  filter: BonoFilter;
  today: string;
}) {
  const list = useLoadMore(initialRows, initialCursor, (cursor) =>
    loadMoreBonosAction({ filter }, cursor),
  );

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
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
                    Botons en línia i no un menú de tres punts: hi ha com a
                    molt dues accions i gairebé mai totes dues, i amagar una
                    sola opció darrere d'un desplegable són més clics, no
                    menys.

                    Un bo decaigut també es pot cobrar: fins ara el client es
                    plantava al centre amb els diners i no hi havia on
                    anotar-los. Els tres casos (pendent, decaigut recuperable i
                    decaigut passat de data) els distingeix el botó, que demana
                    confirmació abans de cobrar.
                  */}
                  <div className="flex justify-end gap-2">
                    {(b.status === "pending_payment" || b.status === "unpaid") && (
                      <MarkBonoPaidButton
                        admin
                        action={markBonoPaidAction}
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
                    {/*
                      `isAdmin: true`: aquesta taula és la de l'administració, i
                      és l'única que pot anul·lar un bo ja cobrat. La regla
                      sencera la decideix `cancelBlockFor`, no aquesta fila.
                    */}
                    {cancelBlockFor(
                      {
                        status: b.status,
                        remainingSessions: b.remainingSessions,
                        totalSessions: b.totalSessions,
                        subscriptionId: b.subscriptionId,
                      },
                      true,
                    ) === null && (
                      <CancelBonoButton
                        action={cancelBonoAction}
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
                  Sense bons en aquest filtre.
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
