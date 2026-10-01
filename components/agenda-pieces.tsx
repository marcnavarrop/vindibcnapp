"use client";

import { TAP, TAP_SURFACE } from "@/lib/utils";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import type { ServiceType } from "@/types/database";

/*
 * Peces de l'agenda que fan servir la rejilla del professional, la de l'admin
 * i «Cal fer». Vivien dins del calendari setmanal vell de l'admin
 * (`weekly-calendar.tsx`, ja esborrat), i en van sortir tal com eren.
 */

type ReservationAction = (formData: FormData) => void | Promise<void>;

/** Icones de servei (SVG inline). */
export const SVC_ICON: Record<ServiceType, React.ReactNode> = {
  ep_individual: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3.5" r="2" /><path d="M1 10c0-3.5 8-3.5 8 0z" />
    </svg>
  ),
  ep_parejas: (
    <svg width="13" height="10" viewBox="0 0 13 10" fill="currentColor" aria-hidden>
      <circle cx="4" cy="3.5" r="2" /><path d="M0 10c0-3.5 8-3.5 8 0z" />
      <circle cx="9" cy="3.5" r="2" /><path d="M5 10c0-3.5 8-3.5 8 0z" />
    </svg>
  ),
  grupo_reducido: (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="3" r="1.7" /><path d="M0 9.5c0-3 5-3 5 0z" />
      <circle cx="8" cy="3" r="1.7" /><path d="M5 9.5c0-3 6-3 6 0z" />
      <circle cx="13.5" cy="3" r="1.7" /><path d="M11 9.5c0-3 5-3 5 0z" />
    </svg>
  ),
  fisioterapia: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <rect x="0" y="2.5" width="1.5" height="4.5" rx="0.75" />
      <rect x="2" y="0.5" width="1.5" height="6" rx="0.75" />
      <rect x="4" y="0" width="1.5" height="6.5" rx="0.75" />
      <rect x="6" y="0.5" width="1.5" height="6" rx="0.75" />
      <rect x="8" y="2" width="1.5" height="5" rx="0.75" />
      <rect x="0" y="6" width="10" height="4" rx="1.5" />
    </svg>
  ),
};

/**
 * El color de «cal fer alguna cosa» a tota l'agenda: «per marcar», les proves
 * i «Cal fer». Blau fosc, lluny del taronja, que és només del grup (el color
 * del seu servei a tota l'app). Sempre va amb un signe que no depèn del color:
 * l'anell i el cercle amb l'exclamació, o la vora discontínua i el rellotge de
 * sorra de la prova pendent.
 */
export const ATTENTION = "#1e3a5f";
/** Les proves, del color de l'atenció (abans, taronja). */
export const TRIAL_COLOR = ATTENTION;

export function TrialModal({
  t,
  canManage,
  acceptAction,
  rejectAction,
  onClose,
}: {
  t: TrialHoldItem;
  canManage: boolean;
  acceptAction?: ReservationAction;
  rejectAction?: ReservationAction;
  onClose: () => void;
}) {
  const when = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t.scheduledAt));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mb-3 h-1.5 w-12 rounded-full"
          style={{ backgroundColor: TRIAL_COLOR }}
        />
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: TRIAL_COLOR }}
          >
            SESSIÓ DE PROVA
          </span>
          <span className="text-xs font-bold text-brand-muted uppercase">
            {t.status === "pending" ? "Pendent" : "Confirmada"}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-bold text-brand-dark">{t.fullName}</h2>
        <p className="mt-1 text-sm text-brand-muted first-letter:uppercase">{when}</p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Telèfon</dt>
            <dd className="font-bold text-brand-dark">
              <a href={`tel:${t.phone}`} className={`hover:text-brand-purple ${TAP}`}>
                {t.phone}
              </a>
            </dd>
          </div>
        </dl>

        {canManage && (acceptAction || rejectAction) ? (
          <div className="mt-5 flex items-center gap-2">
            {t.status === "pending" && acceptAction && (
              <form action={acceptAction} className="flex-1" onSubmit={onClose}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  className={`w-full rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold text-white hover:bg-brand-purple-light ${TAP_SURFACE}`}
                >
                  Acceptar
                </button>
              </form>
            )}
            {rejectAction && (
              <form action={rejectAction} className="flex-1" onSubmit={onClose}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  className={`w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold text-error hover:bg-error/10 ${TAP_SURFACE}`}
                >
                  Rebutjar
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="mt-5 text-sm text-brand-muted">
            Només el professional d&apos;aquesta prova la pot gestionar.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}
        >
          Tancar
        </button>
      </div>
    </div>
  );
}
