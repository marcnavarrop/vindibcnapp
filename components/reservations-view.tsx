"use client";

import { useMemo, useRef, useState } from "react";
import { clsx } from "@/lib/utils";
import { ReservationsAgenda } from "@/components/reservations-agenda";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import {
  SERVICE_LABELS,
  SERVICE_COLORS,
  SERVICE_TYPES,
} from "@/lib/labels";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import type {
  AvailabilityRuleLite,
  TrainerRuleLite,
} from "@/lib/availability-slots";
import type { ServiceType } from "@/types/database";

type ReservationAction = (formData: FormData) => void | Promise<void>;

const NO_FILTER = "";

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
  showCalendarFilters,
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
  /** Mostra la barra de filtres avançats (professional, client, servei). */
  showCalendarFilters?: boolean;
}) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  // "mine" | "none" | trainerId d'un company
  const [availFilter, setAvailFilter] = useState<string>("mine");

  // ── Filtres del calendari d'admin ──────────────────────────────────────────
  const [filterTrainer, setFilterTrainer] = useState<string>(NO_FILTER);
  const [filterService, setFilterService] = useState<string>(NO_FILTER);
  const [filterClient, setFilterClient] = useState<string>("");
  const [clientQuery, setClientQuery] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters =
    filterTrainer !== NO_FILTER ||
    filterService !== NO_FILTER ||
    filterClient !== "";

  // Noms únics de clients per a l'autocomplete
  const allClientNames = useMemo(
    () => [...new Set(reservations.map((r) => r.clientName))].sort(),
    [reservations],
  );

  const suggestions = useMemo(() => {
    if (!clientQuery.trim()) return [];
    const q = clientQuery.toLowerCase();
    return allClientNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [clientQuery, allClientNames]);

  // Reservas filtrades per passar al calendari
  const filteredReservations = useMemo(() => {
    if (!showCalendarFilters || !hasActiveFilters) return reservations;
    return reservations.filter((r) => {
      if (filterTrainer && r.trainerId !== filterTrainer) return false;
      if (filterService && r.serviceType !== filterService) return false;
      if (filterClient && r.clientName !== filterClient) return false;
      return true;
    });
  }, [
    reservations,
    showCalendarFilters,
    hasActiveFilters,
    filterTrainer,
    filterService,
    filterClient,
  ]);

  function clearFilters() {
    setFilterTrainer(NO_FILTER);
    setFilterService(NO_FILTER);
    setFilterClient("");
    setClientQuery("");
  }

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
      {/* ── Barra superior: vista + disponibilitat (trainer) ───────────────── */}
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

      {/* ── Filtres del calendari d'admin ──────────────────────────────────── */}
      {showCalendarFilters && view === "calendar" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-border bg-white px-3 py-2.5">
          {/* Professional */}
          <label className="flex items-center gap-1.5 text-xs">
            <span className="font-bold tracking-wide text-brand-muted uppercase">
              Professional
            </span>
            <select
              value={filterTrainer}
              onChange={(e) => setFilterTrainer(e.target.value)}
              className="rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple"
            >
              <option value="">Tots</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {/* Servei */}
          <label className="flex items-center gap-1.5 text-xs">
            <span className="font-bold tracking-wide text-brand-muted uppercase">
              Servei
            </span>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              className="rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple"
            >
              <option value="">Tots</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_LABELS[s as ServiceType]}
                </option>
              ))}
            </select>
          </label>

          {/* Client (autocomplete) */}
          <div className="relative flex items-center gap-1.5 text-xs">
            <span className="font-bold tracking-wide text-brand-muted uppercase">
              Client
            </span>
            <div className="relative">
              <input
                ref={clientInputRef}
                type="text"
                placeholder="Cerca client…"
                value={filterClient !== "" ? filterClient : clientQuery}
                onChange={(e) => {
                  setFilterClient("");
                  setClientQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (filterClient === "") setShowSuggestions(true);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="w-40 rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple"
              />
              {filterClient !== "" && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterClient("");
                    setClientQuery("");
                    clientInputRef.current?.focus();
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark"
                  aria-label="Esborra filtre de client"
                >
                  ×
                </button>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-brand-border bg-white shadow-lg">
                  {suggestions.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-brand-bg"
                        onMouseDown={() => {
                          setFilterClient(name);
                          setClientQuery(name);
                          setShowSuggestions(false);
                        }}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Netejar */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-bold text-brand-muted hover:text-brand-dark"
            >
              Netejar filtres
            </button>
          )}

          {/* Llegenda de colors per servei */}
          <div className="ml-auto flex items-center gap-3 border-l border-brand-border pl-3">
            {SERVICE_TYPES.map((s) => (
              <span key={s} className="flex items-center gap-1 text-xs text-brand-muted">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: SERVICE_COLORS[s as ServiceType] }}
                />
                {SERVICE_LABELS[s as ServiceType]}
              </span>
            ))}
          </div>
        </div>
      )}

      {view === "calendar" ? (
        <WeeklyCalendar
          reservations={filteredReservations}
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
