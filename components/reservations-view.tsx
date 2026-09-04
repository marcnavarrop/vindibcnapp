"use client";

import { useMemo, useRef, useState } from "react";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";
import { ReservationsAgenda } from "@/components/reservations-agenda";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import {
  SERVICE_LABELS,
  SERVICE_TYPES,
} from "@/lib/labels";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import {
  blocksOf,
  type AvailabilityRuleLite,
  type TrainerRuleLite,
  type AvailabilityBlockLite,
  type TrainerBlockLite,
} from "@/lib/availability-slots";
import {
  colorOfPro,
  colorOfService,
  type ColorPalette,
} from "@/lib/colors";
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
  allBlocks,
  myTrainerId,
  trials,
  manageableTrialIds,
  acceptTrialAction,
  rejectTrialAction,
  showCalendarFilters,
  showColleagueSelector,
  openingHour,
  closingHour,
  palette,
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
  /** Bloquejos temporals de tots els professionals (tapen l'ombrejat). */
  allBlocks?: TrainerBlockLite[];
  /** Horari del centre (configurable per l'admin). */
  openingHour?: number;
  closingHour?: number;
  /** Colors del centre, ja resolts. Es carreguen un cop a la pàgina. */
  palette: ColorPalette;
  /** ID del trainer autenticat (per pre-seleccionar "La meva" disponibilitat). */
  myTrainerId?: string;
  trials?: TrialHoldItem[];
  manageableTrialIds?: string[];
  acceptTrialAction?: ReservationAction;
  rejectTrialAction?: ReservationAction;
  /** Mostra la barra de filtres avançats (professional, client, servei). */
  showCalendarFilters?: boolean;
  /** Mostra el selector de companys (quan el centre ho permet). */
  showColleagueSelector?: boolean;
}) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [showOwnAvail, setShowOwnAvail] = useState(true);
  const [selectedColleagues, setSelectedColleagues] = useState<Set<string>>(new Set());

  // ── Filtres del calendari d'admin ──────────────────────────────────────────
  // Capa de disponibilitat de l'admin, encesa en obrir: saber qui té hores
  // lliures forma part de llegir l'agenda, no és un extra que s'hagi d'anar a
  // buscar. Qui només vulgui veure les reserves l'apaga d'un clic.
  const [showAvailLayer, setShowAvailLayer] = useState(true);
  // Tots marcats: l'admin desmarca qui no li interessa, no al revés.
  const [hiddenAvailTrainers, setHiddenAvailTrainers] = useState<Set<string>>(
    new Set(),
  );

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
    let list = reservations;
    if (showCalendarFilters && hasActiveFilters) {
      list = list.filter((r) => {
        if (filterTrainer && r.trainerId !== filterTrainer) return false;
        if (filterService && r.serviceType !== filterService) return false;
        if (filterClient && r.clientName !== filterClient) return false;
        return true;
      });
    }
    if (showColleagueSelector && myTrainerId) {
      list = list.filter(
        (r) => r.trainerId === myTrainerId || (!!r.trainerId && selectedColleagues.has(r.trainerId)),
      );
    }
    return list;
  }, [
    reservations,
    showCalendarFilters,
    hasActiveFilters,
    filterTrainer,
    filterService,
    filterClient,
    showColleagueSelector,
    myTrainerId,
    selectedColleagues,
  ]);

  function clearFilters() {
    setFilterTrainer(NO_FILTER);
    setFilterService(NO_FILTER);
    setFilterClient("");
    setClientQuery("");
  }

  // Regles efectives a mostrar al calendari (només la pròpia disponibilitat).
  const effectiveAvailability = useMemo((): AvailabilityRuleLite[] | undefined => {
    if (!allAvailability) return availability;
    if (!showOwnAvail || !myTrainerId) return undefined;
    return allAvailability.filter((r) => r.trainerId === myTrainerId);
  }, [allAvailability, availability, showOwnAvail, myTrainerId]);

  // Bloquejos del professional del qual s'ombreja la disponibilitat.
  const effectiveBlocks = useMemo((): AvailabilityBlockLite[] => {
    if (!allBlocks || !myTrainerId) return [];
    return blocksOf(allBlocks, myTrainerId);
  }, [allBlocks, myTrainerId]);

  // Professionals amb alguna regla: qui no en té no pinta res ni surt al llistat.
  const trainersWithRules = useMemo(() => {
    if (!allAvailability) return [];
    const withRules = new Set(allAvailability.map((r) => r.trainerId));
    return trainers.filter((t) => withRules.has(t.id));
  }, [allAvailability, trainers]);

  const availabilityLayers = useMemo(() => {
    if (!showCalendarFilters || !showAvailLayer || !allAvailability) return undefined;
    return trainersWithRules
      .filter((t) => !hiddenAvailTrainers.has(t.id))
      .map((t) => ({
        trainerId: t.id,
        name: t.name,
        color: colorOfPro(palette, t.id),
        rules: allAvailability.filter((r) => r.trainerId === t.id),
      }));
  }, [
    showCalendarFilters,
    showAvailLayer,
    allAvailability,
    trainersWithRules,
    hiddenAvailTrainers,
    palette,
  ]);

  const colleagues = trainers.filter((t) => t.id !== myTrainerId);

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
                TAP,
              )}
            >
              {v === "calendar" ? "Calendari" : "Llista"}
            </button>
          ))}
        </div>

        {/* Només té sentit per a qui TÉ disponibilitat pròpia: l'admin rep les
            regles de tothom, però la seva capa és l'altra (per professional). */}
        {!!allAvailability && !!myTrainerId && view === "calendar" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOwnAvail}
              onChange={(e) => setShowOwnAvail(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-purple"
            />
            <span className="text-brand-muted">Mostrar la meva disponibilitat</span>
          </label>
        )}
      </div>

      {/* ── Selector de companys (trainer amb permís) ─────────────────────── */}
      {showColleagueSelector && view === "calendar" && colleagues.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-brand-border bg-white px-3 py-2.5">
          <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            Companys
          </span>
          {colleagues.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={selectedColleagues.has(t.id)}
                onChange={() =>
                  setSelectedColleagues((prev) => {
                    const next = new Set(prev);
                    if (next.has(t.id)) next.delete(t.id);
                    else next.add(t.id);
                    return next;
                  })
                }
                className="h-3.5 w-3.5 accent-brand-purple"
              />
              <span className="text-brand-charcoal">{t.name}</span>
            </label>
          ))}
        </div>
      )}

      {/* ── Capa de disponibilitat (admin) ─────────────────────────────────── */}
      {showCalendarFilters && view === "calendar" && trainersWithRules.length > 0 && (
        <div className="mb-4 rounded-xl border border-brand-border bg-white px-3 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAvailLayer}
              onChange={(e) => setShowAvailLayer(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-purple"
            />
            <span className="font-bold text-brand-charcoal">
              Mostrar disponibilitat
            </span>
            <span className="text-xs text-brand-muted">
              Ombreja les franges lliures de cada professional, amb el seu color.
            </span>
          </label>

          {showAvailLayer && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-brand-border pt-2.5">
              {trainersWithRules.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenAvailTrainers.has(t.id)}
                    onChange={() =>
                      setHiddenAvailTrainers((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.id)) next.delete(t.id);
                        else next.add(t.id);
                        return next;
                      })
                    }
                    className="h-3.5 w-3.5 accent-brand-purple"
                  />
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOfPro(palette, t.id) }}
                  />
                  <span className="text-brand-charcoal">{t.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

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
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark ${TAP}`}
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
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-brand-bg ${TAP_SURFACE}`}
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
              className={`ml-auto rounded-lg border border-brand-border px-2.5 py-1.5 text-xs font-bold text-brand-muted hover:text-brand-dark ${TAP}`}
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
                  style={{ backgroundColor: colorOfService(palette, s as ServiceType) }}
                />
                {SERVICE_LABELS[s as ServiceType]}
              </span>
            ))}
          </div>
        </div>
      )}

      {view === "calendar" ? (
        <WeeklyCalendar
          palette={palette}
          availabilityLayers={availabilityLayers}
          layerBlocks={allBlocks ?? []}
          reservations={filteredReservations}
          manageableIds={manageableIds ?? reservations.map((r) => r.id)}
          newReservationBase={newReservationBase}
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
          availability={effectiveAvailability}
          blocks={effectiveBlocks}
          openingHour={openingHour}
          closingHour={closingHour}
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
