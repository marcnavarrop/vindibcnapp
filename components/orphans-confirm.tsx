"use client";

import { SERVICE_LABELS } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import { CENTER_TZ } from "@/lib/config";
import type { Orphans } from "@/lib/data/availability-orphans";

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    // Hora del CENTRE, no la del navegador de qui mira.
    timeZone: CENTER_TZ,
  }).format(new Date(iso));
}

function Tag({
  tone,
  children,
}: {
  tone: "warn" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        tone === "warn"
          ? "rounded bg-brand-orange/15 px-1.5 py-0.5 text-[11px] font-bold text-brand-orange"
          : "rounded bg-brand-bg px-1.5 py-0.5 text-[11px] font-bold text-brand-muted"
      }
    >
      {children}
    </span>
  );
}

/**
 * La llista de compromisos orfes, amb una casella per a cadascun.
 *
 * Els noms de les caselles són els que llegeix `selectionFromForm` al servidor.
 * Cada fila diu, abans de decidir, què passarà si es cancel·la: sobretot quan
 * el bo ja ha caducat, que és l'únic cas en què la sessió torna però no es
 * podrà fer servir.
 */
export function OrphansList({
  orphans,
  defaultChecked,
}: {
  orphans: Orphans;
  /** Al pas de confirmació, totes marcades; al plafó, cap. */
  defaultChecked: boolean;
}) {
  const box = "mt-0.5 h-4 w-4 shrink-0 accent-brand-purple";
  return (
    <ul className="space-y-2">
      {orphans.reservations.map((r) => (
        <li key={r.id}>
          <label className="flex items-start gap-2 text-sm text-brand-charcoal">
            <input
              type="checkbox"
              name="cancelReservationIds"
              value={r.id}
              defaultChecked={defaultChecked}
              className={box}
            />
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="font-bold text-brand-dark">{r.clientName}</span>
              <span>
                · {fmtWhen(r.scheduledAt)} · {SERVICE_LABELS[r.serviceType]}
              </span>
              {r.complimentary && (
                <Tag tone="muted">Cortesia: no hi ha sessió a retornar</Tag>
              )}
              {r.bonoExpired && (
                <Tag tone="warn">
                  Bo caducat: la sessió hi torna però no es podrà fer servir
                </Tag>
              )}
              {r.inSeries && (
                <Tag tone="muted">De sèrie: no compta per al total</Tag>
              )}
            </span>
          </label>
        </li>
      ))}
      {orphans.trials.map((t) => (
        <li key={t.id}>
          <label className="flex items-start gap-2 text-sm text-brand-charcoal">
            <input
              type="checkbox"
              name="cancelTrialIds"
              value={t.id}
              defaultChecked={defaultChecked}
              className={box}
            />
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="font-bold text-brand-dark">{t.name}</span>
              <span>
                · {fmtWhen(t.scheduledAt)} · {SERVICE_LABELS[t.serviceType]}
              </span>
              <Tag tone="muted">Sessió de prova: se li avisarà que queda anul·lada</Tag>
            </span>
          </label>
        </li>
      ))}
      {orphans.waitlist.map((w) => (
        <li key={w.id}>
          <label className="flex items-start gap-2 text-sm text-brand-charcoal">
            <input
              type="checkbox"
              name="cancelWaitlistIds"
              value={w.id}
              defaultChecked={defaultChecked}
              className={box}
            />
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="font-bold text-brand-dark">{w.clientName}</span>
              <span>
                · {fmtWhen(w.scheduledAt)} · {SERVICE_LABELS[w.serviceType]}
              </span>
              <Tag tone="muted">Llista d&apos;espera: l&apos;espera es tancarà</Tag>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/**
 * El pas de confirmació de les quatre vies que tanquen disponibilitat.
 *
 * Va DINS del formulari del canvi: el que s'envia en confirmar són els camps
 * del canvi, més `confirmOrphans=1` i les caselles marcades. Mai no es cancel·la
 * res en silenci: si l'usuari desmarca tot, el canvi es desa i els compromisos
 * es queden tal com estan (i al plafó).
 *
 * «Tornar enrere» no desa res: amaga la llista i deixa el formulari com estava.
 */
export function OrphansConfirm({
  orphans,
  what,
  onBack,
}: {
  orphans: Orphans;
  /** «Aquest canvi», «Esborrar aquesta franja», «Aquest bloqueig»… */
  what: string;
  onBack: () => void;
}) {
  const n =
    orphans.reservations.length + orphans.trials.length + orphans.waitlist.length;
  return (
    <div className="w-full rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4">
      <p className="text-sm font-bold text-brand-dark">
        {what} deixa {n === 1 ? "1 compromís" : `${n} compromisos`} fora de la
        disponibilitat
      </p>
      <p className="mt-1 mb-3 text-xs text-brand-muted">
        Encara no s&apos;ha desat res. Les marcades es cancel·laran: es tornarà
        la sessió al bo i s&apos;avisarà cada client per correu. Les que
        desmarquis es mantindran tal com estan, i les podràs veure al plafó
        «Reserves fora de la teva disponibilitat».
      </p>

      <input type="hidden" name="confirmOrphans" value="1" />
      <div className="mb-4">
        <OrphansList orphans={orphans} defaultChecked />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={`rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold text-white hover:bg-brand-purple-light ${TAP}`}
        >
          Desar i cancel·lar les marcades
        </button>
        <button
          type="button"
          onClick={onBack}
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-dark ${TAP}`}
        >
          Tornar enrere
        </button>
      </div>
    </div>
  );
}
