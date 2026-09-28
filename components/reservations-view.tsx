"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TAP, clsx } from "@/lib/utils";
import { ReservationsAgenda } from "@/components/reservations-agenda";
import { TrainerGrid } from "@/components/trainer-grid";
import { AdminGrid } from "@/components/admin-grid";
import type { WaitingNames } from "@/lib/data/waitlist";
import type { CenterBlock } from "@/lib/data/availability-blocks";
import type { OwnBlock } from "@/lib/data/availability-blocks";
import type { BookableClientsResult } from "@/app/(trainer)/trainer/reservas/actions";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { SessionNote } from "@/lib/data/session-notes";
import type { TrialHoldItem } from "@/lib/data/trial-bookings";
import type { TrainerRuleLite, TrainerBlockLite } from "@/lib/availability-slots";
import { colorOfPro, type ColorPalette } from "@/lib/colors";
import type { ReservationActionState } from "@/lib/reservation-action-state";
import type { AgendaNav } from "@/lib/agenda-window";

type ReservationAction = (formData: FormData) => void | Promise<void>;
/** Cancel·lar i marcar feta: tornen si s'ha fet i, si no, per què. */
type StatefulReservationAction = (
  prev: ReservationActionState,
  formData: FormData,
) => Promise<ReservationActionState>;

/** On es recorden els companys triats a la rejilla del professional. */
const COLLEAGUES_KEY = "vindi.trainer.companys";

/**
 * Commutador entre la llista (Properes/Passades) i el calendari: la rejilla
 * del professional (`TrainerGrid`) o l'agenda de l'admin per professional
 * (`AdminGrid`). Comparteixen dades i permisos (manageableIds).
 *
 * QUINA VISTA I QUINA FINESTRA HO DIU LA URL (`nav`): el servidor només porta
 * les reserves de la setmana del calendari o dels dies de la llista, i canviar
 * de vista o de setmana és un enllaç que les torna a demanar. Els filtres i
 * els companys triats són estat del navegador i sobreviuen a la navegació.
 */
export function ReservationsView({
  nav,
  notesFailed,
  reservations,
  trainers,
  nowISO,
  manageableIds,
  cancellableIds,
  notes,
  noteableIds,
  clientBase,
  cancelAction,
  completeAction,
  rescheduleAction,
  allAvailability,
  allBlocks,
  myTrainerId,
  trials,
  manageableTrialIds,
  acceptTrialAction,
  rejectTrialAction,
  showColleagueSelector,
  calendar,
  centerBlocks,
  centerWaiting,
  ownBlocks,
  waiting,
  createFromSlotAction,
  loadBookableClients,
  openingHour,
  closingHour,
  palette,
}: {
  nav: AgendaNav;
  /** La consulta de notes ha fallat: la llista ho diu (vegeu `ReservationsAgenda`). */
  notesFailed?: boolean;
  reservations: ReservationListItem[];
  trainers: { id: string; name: string }[];
  nowISO: string;
  manageableIds?: string[];
  /**
   * Les que es poden CANCEL·LAR, si és una llista diferent de `manageableIds`:
   * el professional pot cancel·lar les de la seva agenda encara que el client
   * sigui d'un company (0091). Sense, les mateixes que `manageableIds`.
   */
  cancellableIds?: string[];
  /** Notes de sessió llegibles i, a part, de quines es pot escriure. Vegeu
   *  `ReservationsAgenda`: són dues llistes diferents a posta. */
  notes?: Record<string, SessionNote>;
  noteableIds?: string[];
  /** On és la fitxa del client en aquesta àrea: la fitxa de la reserva hi enllaça. */
  clientBase: string;
  cancelAction: StatefulReservationAction;
  completeAction: StatefulReservationAction;
  rescheduleAction: StatefulReservationAction;
  /** Totes les regles de tots els professionals. */
  allAvailability?: TrainerRuleLite[];
  /** Bloquejos temporals de tots els professionals (per als forats reals). */
  allBlocks?: TrainerBlockLite[];
  /** Horari del centre (configurable per l'admin). */
  openingHour?: number;
  closingHour?: number;
  /** Colors del centre, ja resolts. Es carreguen un cop a la pàgina. */
  palette: ColorPalette;
  /** ID del professional que mira (la seva rejilla). */
  myTrainerId?: string;
  trials?: TrialHoldItem[];
  manageableTrialIds?: string[];
  acceptTrialAction?: ReservationAction;
  rejectTrialAction?: ReservationAction;
  /** Mostra el selector de companys (quan el centre ho permet). */
  showColleagueSelector?: boolean;
  /**
   * Quin calendari: `"trainer"`, la rejilla del professional (`TrainerGrid`), o
   * `"admin"`, l'agenda per professional (`AdminGrid`). La tria és a la pàgina
   * de cada rol. El calendari setmanal d'abans (`WeeklyCalendar`) ja no hi és.
   */
  calendar: "trainer" | "admin";
  /** Agenda de l'admin: els bloquejos de tots, amb el motiu. */
  centerBlocks?: CenterBlock[];
  /** Agenda de l'admin: qui espera plaça a cada sessió, amb el nom. */
  centerWaiting?: WaitingNames[];
  /** Rejilla del professional: els seus bloquejos, amb el motiu. */
  ownBlocks?: OwnBlock[];
  /** Rejilla del professional: gent en espera per sessió (instant ISO). */
  waiting?: { at: string; count: number }[];
  /** Rejilla del professional i agenda de l'admin: crear sobre un forat i apuntar a un grup. */
  createFromSlotAction?: StatefulReservationAction;
  loadBookableClients?: () => Promise<BookableClientsResult>;
}) {
  const view = nav.view;
  const [showOwnAvail, setShowOwnAvail] = useState(true);
  const [selectedColleagues, setSelectedColleagues] = useState<Set<string>>(new Set());
  /*
   * ELS COMPANYS TRIATS ES RECORDEN AL NAVEGADOR. Apagats per defecte; qui
   * n'encén un el troba encès la propera vegada, en aquest navegador. Es llegeix
   * després de muntar (el servidor no ho sap) i qualsevol error del navegador
   * —mode privat, emmagatzematge blocat— vol dir simplement «cap».
   */
  const [colleaguesLoaded, setColleaguesLoaded] = useState(false);
  useEffect(() => {
    if (!showColleagueSelector) return;
    try {
      const raw = window.localStorage.getItem(COLLEAGUES_KEY);
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(ids)) {
        const known = new Set(trainers.map((t) => t.id));
        setSelectedColleagues(new Set(ids.filter((x): x is string => typeof x === "string" && known.has(x))));
      }
    } catch {
      // Sense memòria: es queden apagats.
    }
    setColleaguesLoaded(true);
    // Només en muntar: després mana el que es toca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!colleaguesLoaded) return;
    try {
      window.localStorage.setItem(COLLEAGUES_KEY, JSON.stringify([...selectedColleagues]));
    } catch {
      // Sense memòria: funciona igual, però no es recordarà.
    }
  }, [selectedColleagues, colleaguesLoaded]);

  // Les reserves de la rejilla del professional: les seves i les dels companys
  // triats.
  const filteredReservations = useMemo(() => {
    if (!showColleagueSelector || !myTrainerId) return reservations;
    return reservations.filter(
      (r) => r.trainerId === myTrainerId || (!!r.trainerId && selectedColleagues.has(r.trainerId)),
    );
  }, [reservations, showColleagueSelector, myTrainerId, selectedColleagues]);

  const colleagues = trainers.filter((t) => t.id !== myTrainerId);

  return (
    <div>
      {/* ── Barra superior: vista + disponibilitat (trainer) ───────────────── */}
      <div
        className={clsx(
          "flex flex-wrap items-center",
          // Compacta al mòbil: el calendari ha de començar amunt.
          "mb-2 gap-2 md:mb-4 md:gap-3",
        )}
      >
        <div className="inline-flex rounded-lg border border-brand-border bg-white p-0.5">
          {(["calendar", "list"] as const).map((v) => (
            <Link
              key={v}
              href={v === "calendar" ? nav.href.calendar : nav.href.list}
              aria-current={view === v ? "page" : undefined}
              className={clsx(
                // 44 px d'alt al mòbil, com la resta de botons que es toquen
                // amb el dit; a l'ordinador, la mida de sempre.
                "flex min-h-11 items-center rounded-md px-3 text-sm font-bold transition-colors md:min-h-0 md:py-1.5",
                view === v
                  ? "bg-brand-purple text-white"
                  : "text-brand-muted hover:text-brand-dark",
                TAP,
              )}
            >
              {v === "calendar" ? "Calendari" : "Llista"}
            </Link>
          ))}
        </div>

        {/* Només té sentit per a qui TÉ disponibilitat pròpia: el professional. */}
        {!!allAvailability && !!myTrainerId && view === "calendar" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOwnAvail}
              onChange={(e) => setShowOwnAvail(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-purple"
            />
            <span className="text-brand-muted">
              <span className="md:hidden">Forats lliures</span>
              <span className="hidden md:inline">Mostrar els meus forats lliures</span>
            </span>
          </label>
        )}
      </div>

      {/* ── Selector de companys (trainer amb permís) ─────────────────────── */}
      {showColleagueSelector && view === "calendar" && colleagues.length > 0 && (
        <div
          className={clsx(
            "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-brand-border bg-white px-3",
            calendar === "trainer" ? "mb-2 py-1.5 md:mb-4 md:py-2.5" : "mb-4 py-2.5",
          )}
        >
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
              {calendar === "trainer" && (
                // El color amb què surt al carril de la rejilla.
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: colorOfPro(palette, t.id) }}
                />
              )}
              <span className="text-brand-charcoal">{t.name}</span>
            </label>
          ))}
        </div>
      )}

      {view === "calendar" &&
      calendar === "trainer" &&
      myTrainerId &&
      createFromSlotAction &&
      loadBookableClients ? (
        <TrainerGrid
          nav={nav}
          palette={palette}
          reservations={filteredReservations}
          occupancyReservations={reservations}
          // Les proves: les pròpies i les dels companys triats, com les reserves.
          trials={(trials ?? []).filter(
            (t) =>
              t.trainerId === myTrainerId ||
              (!!t.trainerId && selectedColleagues.has(t.trainerId)),
          )}
          myTrainerId={myTrainerId}
          rules={(allAvailability ?? []).filter((r) => r.trainerId === myTrainerId)}
          // Els companys encesos, amb el seu color i les seves regles: al
          // carril de la dreta hi van les seves sessions i els seus forats.
          colleagues={colleagues
            .filter((t) => selectedColleagues.has(t.id))
            .map((t) => ({ id: t.id, name: t.name, color: colorOfPro(palette, t.id) }))}
          colleagueRules={(allAvailability ?? []).filter((r) => selectedColleagues.has(r.trainerId))}
          blocks={allBlocks ?? []}
          createFromSlotAction={createFromSlotAction}
          loadBookableClients={loadBookableClients}
          ownBlocks={ownBlocks ?? []}
          waiting={waiting ?? []}
          showFree={showOwnAvail}
          manageableIds={manageableIds ?? []}
          cancellableIds={cancellableIds ?? manageableIds ?? []}
          noteableIds={noteableIds ?? []}
          notes={notes}
          clientBase={clientBase}
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
          manageableTrialIds={manageableTrialIds ?? []}
          acceptTrialAction={acceptTrialAction}
          rejectTrialAction={rejectTrialAction}
          openingHour={openingHour ?? 7}
          closingHour={closingHour ?? 22}
        />
      ) : view === "calendar" && calendar === "admin" && createFromSlotAction ? (
        <AdminGrid
          nav={nav}
          palette={palette}
          reservations={reservations}
          trials={trials ?? []}
          trainers={trainers}
          rules={allAvailability ?? []}
          blocks={allBlocks ?? []}
          centerBlocks={centerBlocks ?? []}
          waiting={centerWaiting ?? []}
          createFromSlotAction={createFromSlotAction}
          notes={notes}
          clientBase={clientBase}
          cancelAction={cancelAction}
          completeAction={completeAction}
          rescheduleAction={rescheduleAction}
          acceptTrialAction={acceptTrialAction}
          rejectTrialAction={rejectTrialAction}
          openingHour={openingHour ?? 7}
          closingHour={closingHour ?? 22}
        />
      ) : (
        <ReservationsAgenda
          nav={nav}
          notesFailed={notesFailed}
          reservations={reservations}
          trainers={trainers}
          nowISO={nowISO}
          manageableIds={manageableIds}
          cancellableIds={cancellableIds}
          notes={notes}
          noteableIds={noteableIds}
          // Les accions de l'àrea on s'és, per props. Abans la llista
          // importava les de l'ADMIN també a l'àrea del professional, i
          // revalidava /admin: la llista del professional no es refrescava.
          cancelAction={cancelAction}
          completeAction={completeAction}
        />
      )}
    </div>
  );
}
