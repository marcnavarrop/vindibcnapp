"use client";

import { useMemo, useState } from "react";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";
import { localDateStr } from "@/lib/availability-slots";
import { freeServicesAt, occupancyFromSessions } from "@/lib/free-slots";
import {
  getRescheduleOptionsAction,
  type RescheduleOptionsResult,
} from "@/lib/actions/reservation-detail";
import { SESSION_DURATION_MINUTES, SERVICE_LABELS } from "@/lib/labels";
import type { ReservationListItem } from "@/lib/data/reservations";

const RESCHEDULE_DAYS = 14;
const dayFmt = new Intl.DateTimeFormat("ca-ES", { weekday: "short", day: "numeric" });
const longFmt = new Intl.DateTimeFormat("ca-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * REPROGRAMAR TRIANT UN INICI QUE EXISTEIX.
 *
 * En comptes del camp de data i hora, els inicis on la reserva hi cap de debò:
 * `freeServicesAt` amb el servei de la reserva i sense comptar-la a ella a
 * l'ocupació, de manera que la seva hora actual i les contigües surten com a
 * lliures. Les dades es demanen en obrir (`getRescheduleOptionsAction`) i es
 * calcula aquí, en l'hora del navegador, com la rejilla.
 *
 * El servidor ho torna a comprovar en moure (0093): si mentrestant algú ha
 * agafat l'hora, l'error surt aquí mateix.
 */
export function ReschedulePicker({
  r,
  action,
  pending,
  error,
}: {
  r: ReservationListItem;
  action: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RescheduleOptionsResult | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [pick, setPick] = useState<Date | null>(null);

  const load = () => {
    setOpen(true);
    setData(null);
    getRescheduleOptionsAction(r.id)
      .then(setData)
      .catch(() => setData({ ok: false, error: "No s'han pogut carregar les hores lliures." }));
  };

  // Inicis vàlids per dia: el servei de la reserva hi cap, és futur i no és la
  // mateixa hora d'ara.
  const byDay = useMemo(() => {
    const out = new Map<string, Date[]>();
    if (!data?.ok) return out;
    const d = data.data;
    const occupancy = occupancyFromSessions(d.occupied);
    const current = new Date(d.scheduledAt).getTime();
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < RESCHEDULE_DAYS; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const list: Date[] = [];
      for (let slot = 0; slot < 48; slot++) {
        const at = new Date(date);
        at.setHours(0, slot * 30, 0, 0);
        if (at.getTime() <= now || at.getTime() === current) continue;
        const free = freeServicesAt({
          rules: d.rules,
          blocks: d.blocks,
          trainerId: d.trainerId,
          date,
          slot,
          durationMinutes: SESSION_DURATION_MINUTES,
          occupancy,
        });
        if (free.has(d.serviceType)) list.push(at);
      }
      if (list.length) out.set(localDateStr(date), list);
    }
    return out;
  }, [data]);

  const days = [...byDay.keys()];
  const shownDay = day && byDay.has(day) ? day : (days[0] ?? null);

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-brand-bg p-3" data-reschedule>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
          Reprogramar
        </span>
        {!open && (
          <button
            type="button"
            onClick={load}
            className={`min-h-11 rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-purple hover:bg-brand-bg md:min-h-9 ${TAP}`}
          >
            Canviar l&apos;hora
          </button>
        )}
      </div>

      {r.seriesId && (
        <p className="text-xs text-brand-muted">
          ↻ És d&apos;una sèrie: es mou només aquesta sessió. Les altres de la sèrie
          es queden on són.
        </p>
      )}

      {open && !data && (
        <p className="text-sm text-brand-muted" aria-live="polite">
          Buscant hores lliures…
        </p>
      )}
      {open && data && !data.ok && (
        <p role="alert" className="text-sm text-error">
          {data.error}
        </p>
      )}
      {open && data?.ok && days.length === 0 && (
        <p className="text-sm text-brand-muted">
          No hi ha cap hora lliure per a {SERVICE_LABELS[r.serviceType].toLowerCase()} en
          els pròxims {RESCHEDULE_DAYS} dies.
        </p>
      )}

      {open && data?.ok && days.length > 0 && (
        <>
          {/* Els dies amb algun inici, de costat; es llisquen si no hi caben. */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Dia">
            {days.map((k) => {
              const d = byDay.get(k)![0];
              const active = k === shownDay;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-day-option={k}
                  onClick={() => {
                    setDay(k);
                    setPick(null);
                  }}
                  className={clsx(
                    "flex min-h-11 shrink-0 flex-col items-center justify-center rounded-lg border px-2.5 text-xs font-bold",
                    active
                      ? "border-brand-purple bg-brand-purple text-white"
                      : "border-brand-border bg-white text-brand-charcoal",
                    TAP,
                  )}
                >
                  <span className="first-letter:uppercase">{dayFmt.format(d)}</span>
                  <span className={active ? "text-white/80" : "text-brand-muted"}>
                    {byDay.get(k)!.length}
                  </span>
                </button>
              );
            })}
          </div>
          {shownDay && (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="group" aria-label="Hores lliures">
              {byDay.get(shownDay)!.map((t) => {
                const active = pick?.getTime() === t.getTime();
                return (
                  <button
                    key={t.toISOString()}
                    type="button"
                    data-start={t.toISOString()}
                    aria-pressed={active}
                    onClick={() => setPick(t)}
                    className={clsx(
                      "min-h-11 rounded-lg border text-sm font-bold",
                      active
                        ? "border-brand-orange bg-brand-orange text-white"
                        : "border-brand-border bg-white text-brand-charcoal hover:bg-brand-bg",
                      TAP_SURFACE,
                    )}
                  >
                    {hhmm(t)}
                  </button>
                );
              })}
            </div>
          )}
          <form action={action}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="scheduledAtIso" value={pick?.toISOString() ?? ""} />
            <button
              type="submit"
              disabled={!pick || pending}
              className={`w-full rounded-lg bg-brand-orange px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 ${TAP_SURFACE}`}
            >
              {pending
                ? "Movent…"
                : pick
                  ? `Moure a ${longFmt.format(pick)}, a les ${hhmm(pick)}`
                  : "Tria una hora"}
            </button>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
