"use client";

import { useMemo, useState } from "react";
import { clsx } from "@/lib/utils";
import { ReservationsAgenda } from "@/components/reservations-agenda";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import type { AvailabilityRuleLite, TrainerRuleLite } from "@/lib/availability-slots";

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
  availability,
  allAvailability,
  myTrainerId,
  trials,
  manageableTrialIds,
  acceptTrialAction,
  rejectTrialAction,
}: {
  reservations: ReservationListItem[];
  trainers: { id: string; name: string }[];
  nowISO: string;
  manageableIds?: string[];
  newReservationBase: string;
  cancelAction: ReservationAction;
  completeAction: ReservationAction;
  rescheduleAction: ReservationAction;
  /** Compatibilitat amb l'ús des de l'admin (sense selector de companys). */
  availability?: AvailabilityRuleLite[];
  /** Totes les regles de tots els professionals (per al selector del trainer). */
  allAvailability?: TrainerRuleLite[];
  /** ID del trainer autenticat (per pre-seleccionar "La meva" disponibilitat). */
  myTrainerId?: string;
  trials?: TrialHoldItem[];
  manageableTrialIds?: string[];
  acceptTrialAction?: ReservationAction;
  rejectTrialAction?: ReservationAction;
}) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  // "mine" | "none" | trainerId d'un company
  const [availFilter, setAvailFilter] = useState<string>("mine");

  // Regles efectives a mostrar al calendari, depenent del selector.
  const effectiveAvailability = useMemo((): AvailabilityRuleLite[] | undefined => {
    // Si ve de l'admin (sense allAvailability), usa el prop clàssic.
    if (!allAvailability) return availability;
    if (availFilter === "none") return undefined;
    const targetId = availFilter === "mine" ? myTrainerId : availFilter;
    if (!targetId) return undefined;
    return allAvailability.filter((r) => r.trainerId === targetId);
  }, [allAvailability, availability, availFilter, myTrainerId]);

  const showAvailSelector = !!allAvailability && trainers.length > 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-brand-border bg-white p-0.5">
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

        {showAvailSelector && view === "calendar" && (
          <label className="flex items-center gap-2 text-xs">
            <span className="font-bold tracking-wide text-brand-muted uppercase">
              Disponibilitat
            </span>
            <select
              value={availFilter}
              onChange={(e) => setAvailFilter(e.target.value)}
              className="rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple"
            >
              <option value="mine">La meva</option>
              {trainers
                .filter((t) => t.id !== myTrainerId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              <option value="none">Cap</option>
            </select>
          </label>
        )}
      </div>

      {view === "calendar" ? (
        <WeeklyCalendar
          reservations={reservations}
          manageableIds={manageableIds ?? reservations.map((r) => r.id)}
          newReservationBase={newReservationBase}
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
          availability={effectiveAvailability}
          trials={trials}
          manageableTrialIds={manageableTrialIds}
          acceptTrialAction={acceptTrialAction}
          rejectTrialAction={rejectTrialAction}
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
