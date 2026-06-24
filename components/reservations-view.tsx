"use client";

import { useState } from "react";
import { clsx } from "@/lib/utils";
import { ReservationsAgenda } from "@/components/reservations-agenda";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import type { ReservationListItem } from "@/lib/data/reservations";

type ReservationAction = (formData: FormData) => void | Promise<void>;

/**
 * Conmutador entre la lista (Properes/Passades) y el calendario semanal.
 * La lista conserva los filtros por entrenador/estado; el calendario aporta la
 * vista de agenda semanal. Ambos comparten datos y permisos (manageableIds).
 */
export function ReservationsView({
  reservations,
  trainers,
  nowISO,
  manageableIds,
  newReservationBase,
  cancelAction,
  completeAction,
  rescheduleAction,
}: {
  reservations: ReservationListItem[];
  trainers: { id: string; name: string }[];
  nowISO: string;
  manageableIds?: string[];
  newReservationBase: string;
  cancelAction: ReservationAction;
  completeAction: ReservationAction;
  rescheduleAction: ReservationAction;
}) {
  const [view, setView] = useState<"calendar" | "list">("calendar");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-brand-border bg-white p-0.5">
        {(["calendar", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
              view === v
                ? "bg-brand-purple text-white"
                : "text-brand-muted hover:text-brand-dark",
            )}
          >
            {v === "calendar" ? "Calendari" : "Llista"}
          </button>
        ))}
      </div>

      {view === "calendar" ? (
        <WeeklyCalendar
          reservations={reservations}
          manageableIds={manageableIds ?? reservations.map((r) => r.id)}
          newReservationBase={newReservationBase}
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
        />
      ) : (
        <ReservationsAgenda
          reservations={reservations}
          trainers={trainers}
          nowISO={nowISO}
          manageableIds={manageableIds}
        />
      )}
    </div>
  );
}
