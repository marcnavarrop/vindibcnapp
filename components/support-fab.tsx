"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  formatDate,
} from "@/lib/labels";
import {
  createTicketFromWidgetAction,
  listMyRecentTicketsAction,
} from "@/lib/actions/support";
import type { SupportTicket } from "@/lib/data/support";
import type { SupportStatus } from "@/types/database";

const STATUS_TONE: Record<SupportStatus, "warn" | "info" | "success"> = {
  open: "warn",
  in_progress: "info",
  resolved: "success",
};

function LifebuoyIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.6" />
      <line x1="14.6" y1="9.4" x2="18.4" y2="5.6" />
      <line x1="5.6" y1="18.4" x2="9.4" y2="14.6" />
      <line x1="14.6" y1="14.6" x2="18.4" y2="18.4" />
      <line x1="5.6" y1="5.6" x2="9.4" y2="9.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Formulari d'alta ràpida. Estat d'acció propi, per poder-lo reiniciar. */
function QuickTicketForm({ onCreated }: { onCreated: () => void }) {
  const [state, formAction] = useActionState(createTicketFromWidgetAction, {});

  useEffect(() => {
    if (state.ok) onCreated();
  }, [state.ok, onCreated]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="title"
        required
        maxLength={150}
        placeholder="Què passa? (una línia)"
        aria-label="Títol"
        className="rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
      />
      <select
        name="category"
        required
        defaultValue="bug"
        aria-label="Categoria"
        className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
      >
        {SUPPORT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {SUPPORT_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <textarea
        name="description"
        required
        rows={4}
        maxLength={5000}
        placeholder="Explica-ho amb detall: on ho has vist i què esperaves que passés."
        aria-label="Descripció"
        className="resize-y rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
      />
      {state.error && <p className="text-xs text-error">{state.error}</p>}
      {state.ok && (
        <p className="text-xs text-success">Tiquet enviat. Gràcies!</p>
      )}
      <SubmitButton>Enviar</SubmitButton>
    </form>
  );
}

/**
 * Accés ràpid al suport des de qualsevol pantalla d'admin o professional.
 *
 * Viu al marc comú de les dues àrees, no a cada pàgina. La llista de tiquets
 * es demana en OBRIR el panell i no al carregar la pàgina: si es carregués
 * amb el marc, cada pantalla de l'app pagaria una consulta que gairebé mai es
 * mira.
 */
export function SupportFab({ basePath }: { basePath: string }) {
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  /** Puja a cada obertura; reinicia el formulari via `key`. */
  const [openCount, setOpenCount] = useState(0);

  const load = useCallback(() => {
    listMyRecentTicketsAction().then(setTickets, () => setTickets([]));
  }, []);

  // En obrir, la llista es torna a demanar (i el formulari la refresca ell
  // mateix quan en crea un).
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Tancar amb Escape, com la resta de diàlegs de l'app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* ── Botó ──
          z-30: per sobre del contingut, però per sota dels modals i del calaix
          del menú (z-40/z-50), que no ha de quedar amb un botó a sobre.
          A l'esquerra hi ha el sidebar i el "Tancar sessió": aquest va a la
          dreta i no els tapa ni en mòbil, on el menú és un calaix. */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setOpenCount((n) => n + 1);
        }}
        aria-expanded={open}
        aria-label={open ? "Tancar el suport" : "Obrir el suport"}
        className="fixed right-4 bottom-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple text-white shadow-lg transition-colors hover:bg-brand-purple-light focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 sm:right-6 sm:bottom-6"
      >
        {open ? <CloseIcon /> : <LifebuoyIcon />}
      </button>

      {open && (
        <>
          {/* Fons: tanca en tocar fora i, en mòbil, separa el panell de la
              pàgina de sota. */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Panell: full de baix en mòbil, targeta ancorada al botó en
              escriptori. L'alçada màxima evita que un historial llarg el
              faci més alt que la pantalla. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Suport"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border border-brand-border bg-white shadow-xl sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-96 sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-border bg-brand-purple px-5 py-3 text-white">
              <div>
                <p className="text-sm font-bold">Suport</p>
                <p className="text-xs text-white/70">
                  Errors, dubtes i idees sobre l&apos;app
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tancar"
                className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* ── Alta ràpida ──
                  La `key` el fa estrenar a cada obertura: si no, en reobrir el
                  panell hi seguia el "Tiquet enviat" d'una estona abans, que
                  semblava dir que s'acabava d'enviar alguna cosa. */}
              <QuickTicketForm key={openCount} onCreated={load} />

              {/* ── Els meus darrers tiquets ── */}
              <div className="mt-5 border-t border-brand-border pt-4">
                <p className="mb-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
                  Els meus tiquets recents
                </p>

                {tickets === null ? (
                  <p className="text-xs text-brand-muted">Carregant…</p>
                ) : tickets.length === 0 ? (
                  <p className="text-xs text-brand-muted">
                    Encara no n&apos;has obert cap.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-brand-border">
                    {tickets.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-brand-dark">
                            {t.title}
                          </p>
                          <p className="text-[11px] text-brand-muted">
                            {SUPPORT_CATEGORY_LABELS[t.category]} ·{" "}
                            {formatDate(t.createdAt)}
                          </p>
                        </div>
                        <span className="shrink-0">
                          <Badge tone={STATUS_TONE[t.status]}>
                            {SUPPORT_STATUS_LABELS[t.status]}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  href={basePath}
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-block text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                >
                  Veure tot l&apos;historial →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
