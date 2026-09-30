"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { clsx, TAP, TAP_SURFACE } from "@/lib/utils";
import type { ClientsPageItem } from "@/lib/data/clients";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { LoadMoreFooter, useLoadMore, useUrlQuery } from "@/components/server-list";
import { loadMoreClientsAction } from "@/app/actions/client-list-actions";

/**
 * La llista de clients del professional: "Els meus / Tots". Qualsevol fitxa
 * es pot obrir; les accions de gestió només surten als seus assignats.
 *
 * Com la de l'admin, la cerca i «Els meus / Tots» es fan al SERVIDOR
 * (`listClientsPage`) i la llista va per pàgines. Abans es portaven tots els
 * clients del centre al navegador.
 */
export function TrainerClientsTable({
  initialRows,
  initialCursor,
  total,
  q,
  scope,
  professionalId,
  trainers,
}: {
  initialRows: ClientsPageItem[];
  initialCursor: string | null;
  total: number | null;
  q: string;
  scope: "mine" | "all";
  /** A «Tots»: la cartera de quin professional (null = tots). */
  professionalId: string | null;
  trainers: { id: string; name: string }[];
}) {
  const search = useUrlQuery();
  const router = useRouter();
  const pathname = usePathname();
  const [switching, startSwitch] = useTransition();
  const href = (s: "mine" | "all", pro: string | null) => {
    const p = new URLSearchParams();
    if (s === "all") p.set("tots", "1");
    if (s === "all" && pro) p.set("professional", pro);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const scopeHref = (s: "mine" | "all") => href(s, null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Quins clients" className="inline-flex rounded-lg border border-brand-border bg-white p-0.5">
          {(["mine", "all"] as const).map((s) => (
            <Link
              key={s}
              href={scopeHref(s)}
              replace
              scroll={false}
              aria-current={scope === s ? "page" : undefined}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
                scope === s
                  ? "bg-brand-purple text-white"
                  : "text-brand-muted hover:text-brand-dark",
                TAP,
              )}
            >
              {s === "mine" ? "Els meus" : "Tots"}
            </Link>
          ))}
        </nav>
        <input
          type="search"
          value={search.value}
          onChange={(e) => search.setValue(e.target.value)}
          placeholder="Cerca per nom, correu o telèfon…"
          aria-label="Cerca clients"
          className="w-full max-w-sm rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        />
        {scope === "all" && (
          <label className="flex items-center gap-2 text-sm text-brand-muted">
            <span className="whitespace-nowrap">Professional</span>
            <select
              value={professionalId ?? ""}
              onChange={(e) =>
                startSwitch(() => router.replace(href("all", e.target.value || null), { scroll: false }))
              }
              className="min-h-11 rounded-lg border border-brand-border bg-white px-3 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
            >
              <option value="">Tots</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {(search.pending || switching) && (
          <span className="text-sm text-brand-muted" aria-live="polite">
            Buscant…
          </span>
        )}
      </div>

      <TrainerClientsRows
        key={`${scope}|${professionalId ?? ""}|${q}`}
        initialRows={initialRows}
        initialCursor={initialCursor}
        total={total}
        q={q}
        scope={scope}
        professionalId={professionalId}
        dim={search.pending || switching}
      />
    </div>
  );
}

function TrainerClientsRows({
  initialRows,
  initialCursor,
  total,
  q,
  scope,
  professionalId,
  dim,
}: {
  initialRows: ClientsPageItem[];
  initialCursor: string | null;
  total: number | null;
  q: string;
  scope: "mine" | "all";
  professionalId: string | null;
  dim: boolean;
}) {
  const list = useLoadMore(initialRows, initialCursor, (cursor) =>
    loadMoreClientsAction({ q, scope, professionalId }, cursor),
  );

  return (
    <>
      <div
        className={clsx(
          "overflow-x-auto rounded-2xl border border-brand-border bg-white transition-opacity",
          dim && "opacity-60",
        )}
      >
        <table className="w-full min-w-[40rem] text-left text-sm" data-testid="clients-table">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Professional</th>
              <th className="px-4 py-3 font-bold">Bons actius</th>
              <th className="px-4 py-3 font-bold">Sessions rest.</th>
              <th className="px-4 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((c) => (
              <tr
                key={c.id}
                className={`border-b border-brand-border last:border-0 hover:bg-brand-bg/50 active:bg-brand-bg ${TAP_SURFACE}`}
              >
                <CellLink href={`/trainer/clients/${c.id}`} first>
                  <span className="font-bold text-brand-dark">{c.fullName}</span>
                </CellLink>
                <CellLink href={`/trainer/clients/${c.id}`}>
                  {c.trainerName ?? (
                    <span className="text-brand-muted italic">
                      Sense assignar
                    </span>
                  )}
                </CellLink>
                <CellLink href={`/trainer/clients/${c.id}`}>
                  {c.activeBonos}
                </CellLink>
                <CellLink href={`/trainer/clients/${c.id}`}>
                  <span className="font-bold text-brand-purple">
                    {c.remainingSessions}
                  </span>
                </CellLink>
                {/* Cel·la nova, FORA dels CellLink: si la icona anés dins d'un
                    enllaç a la fitxa, tocar-la obriria la fitxa i no WhatsApp.
                    Mateix criteri que la taula de l'admin.

                    El buit es reserva sempre, com allà. Aquí no hi ha text que
                    es pugui partir, però la icona fa 32 px d'alçada: sense el
                    buit, les files amb telèfon feien 57 px i les que no, 44,5.
                    La mateixa irregularitat, en vertical. */}
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                      <WhatsAppLink phone={c.phone} name={c.fullName} variant="icon" />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {list.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-muted"
                >
                  {q ? "No s'ha trobat cap client amb aquesta cerca." : "Sense clients."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <LoadMoreFooter
        shown={list.items.length}
        total={total}
        noun="clients"
        hasMore={list.hasMore}
        pending={list.pending}
        error={list.error}
        onLoadMore={list.loadMore}
      />
    </>
  );
}

/** Vegeu `CellLink` a `clients-table.tsx`: mateixa raó, mateixa forma. */
function CellLink({
  href,
  first,
  children,
}: {
  href: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <td className="p-0">
      <Link
        href={href}
        tabIndex={first ? undefined : -1}
        className="block px-4 py-3"
      >
        {children}
      </Link>
    </td>
  );
}
