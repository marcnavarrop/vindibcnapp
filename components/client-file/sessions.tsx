"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SERVICE_LABELS, RESERVATION_STATUS_LABELS, formatTime, sessionDayParts } from "@/lib/labels";
import { clsx, TAP } from "@/lib/utils";
import type { ClientReservation } from "@/lib/data/clients";
import { splitSessions } from "@/components/client-file/split-sessions";

/** Una sessió: la casella del dia, l'hora i el servei, i amb qui. */
export function SessionRow({ r, now }: { r: ClientReservation; now: string }) {
  const d = sessionDayParts(r.scheduledAt);
  // Passada i encara «Reservada»: ningú no l'ha marcada. Es diu, perquè
  // «Reservada» d'una sessió de fa un mes no és veritat.
  const unmarked = r.status === "booked" && Date.parse(r.scheduledAt) < Date.parse(now);
  return (
    <li className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 px-4 py-2.5 sm:px-5">
      <div className="rounded-lg border border-brand-border py-1 text-center leading-tight">
        <span className="block text-[10.5px] font-bold text-brand-muted uppercase">{d.weekday}</span>
        <b className="block text-lg text-brand-dark tabular-nums">{d.day}</b>
        <span className="block text-[10.5px] font-bold text-brand-muted uppercase">{d.month}</span>
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-bold text-brand-dark">
          <span className="tabular-nums">{formatTime(r.scheduledAt)}</span> · {SERVICE_LABELS[r.serviceType]}
        </p>
        {r.trainerName && <p className="truncate text-brand-muted">amb {r.trainerName}</p>}
      </div>
      {/*
        Les properes no porten etiqueta: totes són «Reservada», i al mòbil
        l'etiqueta partia en dues línies l'hora i el servei.
      */}
      {unmarked ? (
        <Badge tone="attention" icon="alert">Per marcar</Badge>
      ) : r.status === "booked" ? (
        <span />
      ) : (
        <Badge tone={r.status === "completed" ? "success" : "neutral"}>
          {RESERVATION_STATUS_LABELS[r.status]}
        </Badge>
      )}
    </li>
  );
}

const PAGE = 20;

/**
 * La pestanya Sessions. Les cancel·lades no surten si no es demanen: només el
 * seu comptador. Cada pila ensenya les 20 primeres i «Mostrar-ne més».
 */
export function SessionsList({
  reservations,
  now,
}: {
  reservations: ClientReservation[];
  now: string;
}) {
  const groups = splitSessions(reservations, now);
  const [which, setWhich] = useState<"upcoming" | "past" | "cancelled">(
    groups.upcoming.length > 0 || groups.past.length === 0 ? "upcoming" : "past",
  );
  const [shown, setShown] = useState(PAGE);
  const list = groups[which];
  const chips = [
    { key: "upcoming" as const, label: "Properes", n: groups.upcoming.length },
    { key: "past" as const, label: "Passades", n: groups.past.length },
    { key: "cancelled" as const, label: "Cancel·lades", n: groups.cancelled.length },
  ];
  const empty = {
    upcoming: "No té cap sessió reservada.",
    past: "Encara no té cap sessió passada.",
    cancelled: "No té cap sessió cancel·lada.",
  }[which];

  return (
    <div className="flex flex-col">
      <div role="group" aria-label="Quines sessions" className="flex flex-wrap gap-1.5 px-4 pt-3 pb-2 sm:px-5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={which === c.key}
            onClick={() => {
              setWhich(c.key);
              setShown(PAGE);
            }}
            className={clsx(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-bold",
              TAP,
              which === c.key
                ? "border-brand-dark bg-brand-dark text-white"
                : "border-brand-border bg-white text-brand-tab hover:text-brand-dark",
            )}
          >
            {c.label}
            <span className="tabular-nums">{c.n}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-brand-muted sm:px-5">{empty}</p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {list.slice(0, shown).map((r) => (
            <SessionRow key={r.id} r={r} now={now} />
          ))}
        </ul>
      )}
      {list.length > shown && (
        <div className="border-t border-brand-border px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:underline ${TAP}`}
          >
            Mostrar-ne més ({list.length - shown})
          </button>
        </div>
      )}
    </div>
  );
}
