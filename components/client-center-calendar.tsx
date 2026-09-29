"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { clsx, TAP } from "@/lib/utils";
import {
  SERVICE_TYPES,
  GROUP_CAPACITY,
  SESSION_DURATION_MINUTES,
} from "@/lib/labels";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import {
  weekdayOf,
  localDateStr,
  hourToSlot,
  localSlotOf,
  isOnTheHour,
  slotToHHMM,
  slotsFor,
  SLOT_MINUTES,
} from "@/lib/availability-slots";
import type { ClientCenterData } from "@/lib/data/client-calendar";
import { colorOfPro, colorOfService, type ColorPalette } from "@/lib/colors";
import { Avatar } from "@/components/ui/avatar";
import type { ServiceType } from "@/types/database";
import type { SeriesReviewState } from "@/components/forms/series-wizard";
import { canRepeatInSeries } from "@/lib/series-rules";
import {
  CreateModal,
  OwnModal,
  WaitlistModal,
  type CreateAction,
  type CancelAction,
} from "@/components/client/booking-dialogs";
import { getOccupancyStatus } from "@/lib/group-occupancy";
import { freeServicesAt, occupancyFromSessions } from "@/lib/free-slots";
import { clientBookingScope, requiresAssignedTrainer } from "@/lib/booking-scope";

export type { CreateAction, CancelAction, CancelState } from "@/components/client/booking-dialogs";

/* Els noms dels dies i les abreviatures de servei viuen al diccionari
   (`reservas.days` i `reservas.serviceBadge`). */

/** Icones de servei (SVG inline, ~10 px). També les fa servir la llista nova. */
export const SVC_ICON: Record<ServiceType, React.ReactNode> = {
  ep_individual: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3.5" r="2" />
      <path d="M1 10c0-3.5 8-3.5 8 0z" />
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

/** Primer nom (per a la vista compacta de les fitxes). */
const firstName = (name: string) => name.split(" ")[0];

function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Un elemento a pintar en una celda (chip). */
type CellItem =
  | {
      kind: "own";
      id: string;
      trainerId: string | null;
      service: ServiceType;
      slot: Date;
      groupCount?: number;
      /**
       * Noms de pila dels ALTRES del grup, per al detall que s'obre en clicar.
       * A la graella NO hi surten: una cel·la del calendari es veu de lluny i
       * sense voler-ho, i qui hi ha apuntat és cosa de qui obre la sessió.
       */
      mates?: string[];
    }
  | { kind: "occupied"; trainerId: string | null; service: ServiceType }
  | {
      kind: "group";
      trainerId: string | null;
      count: number;
      joinable: boolean;
      /**
       * Plena, però el client s'hi podria apuntar a la cua: té bo del servei,
       * és al futur i no té res més a aquella hora. Que la cua estigui oberta
       * ho decideix el centre i es mira a part.
       */
      waitlistable: boolean;
      slot: Date;
      /** Qui ja s'hi ha apuntat, pel nom de pila. Només per al detall. */
      mates: string[];
    }
  | {
      kind: "free";
      trainerId: string;
      service: ServiceType;
      slot: Date;
    };

/** Quantes files de mitja hora ocupa una sessió. Avui, dues. */
const SLOTS_PER_SESSION = slotsFor(SESSION_DURATION_MINUTES);

export function ClientCenterCalendar({
  data,
  createAction,
  cancelAction,
  minCancellationHours = 0,
  openingHour = 7,
  closingHour = 22,
  palette,
  onSeriesReady,
  onDialogOpen,
  waitlistEnabled = false,
  subscriptionServiceType = null,
  waitlist = [],
}: {
  data: ClientCenterData;
  createAction: CreateAction;
  cancelAction: CancelAction;
  /** El centre accepta inscripcions noves a la cua. */
  waitlistEnabled?: boolean;
  /** De quin servei és la subscripció viva del client, si en té (0072/0086). */
  subscriptionServiceType?: ServiceType | null;
  /** Les esperes VIVES del client, per no oferir-li apuntar-s'hi dos cops. */
  waitlist?: { id: string; trainerId: string | null; desiredAt: string }[];
  /**
   * Si hi és, els diàlegs ofereixen també repetir la sessió en bucle i, un cop
   * calculada, entreguen aquí el resultat perquè algú el pinti. Opcional a
   * propòsit: el calendari segueix servint tal qual allà on no calgui.
   */
  onSeriesReady?: (review: SeriesReviewState) => void;
  /**
   * S'avisa en obrir qualsevol diàleg.
   *
   * Serveix per tancar el panell de revisió: tenir-lo obert parlant d'un dia
   * mentre un diàleg en parla d'un altre era la confusió que es podia donar
   * abans, i amb això no hi ha mai dues intencions a la pantalla.
   */
  onDialogOpen?: () => void;
  minCancellationHours?: number;
  /** Colors del centre, ja resolts. Es carreguen un cop a la pàgina. */
  palette: ColorPalette;
  /** Horari del centre (configurable per l'admin). */
  openingHour?: number;
  closingHour?: number;
}) {
  const router = useRouter();
  const { bonoTypes, trainers, rules, blocks, reservations, assignedTrainerId } =
    data;

  const t = useTranslations("reservas");
  const tl = useTranslations("labels.service");
  const tb = useTranslations("reservas.serviceBadge");
  const locale = useLocale() as Locale;
  const [view, setView] = useState<"day" | "week">("week");
  const [offset, setOffset] = useState(0); // en días (día) o semanas (semana)
  // Fins on es pot anar enrere: la setmana d'avui. En setmanes, zero; en dies,
  // fins al dilluns d'aquesta setmana.
  const minOffset = view === "week" ? 0 : -((new Date().getDay() + 6) % 7);
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "all">(
    "all",
  );
  const [trainerFilter, setTrainerFilter] = useState<string | "all">(
    assignedTrainerId ?? "all",
  );
  const [book, setBook] = useState<{
    trainerId: string;
    service: ServiceType;
    slot: Date;
    /** Qui ja hi és, si és un grup. Buit a la resta de serveis. */
    mates?: string[];
  } | null>(null);
  const [own, setOwn] = useState<CellItem & { kind: "own" } | null>(null);
  const [wait, setWait] = useState<{
    trainerId: string;
    slot: Date;
    /** Si ja hi és, l'id de l'entrada, per poder-se donar de baixa. */
    entryId: string | null;
  } | null>(null);

  // Les esperes vives, per franja. Es compara per INSTANT: la cua desa data i
  // hora del centre i el calendari treballa amb instants; casar-ho per cadena
  // seria tornar a ensopegar amb la mateixa pedra de sempre.
  const waitingIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of waitlist)
      m.set(`${w.trainerId}|${new Date(w.desiredAt).getTime()}`, w.id);
    return m;
  }, [waitlist]);
  const waitingAt = (trainerId: string | null, slot: Date) =>
    waitingIndex.get(`${trainerId}|${slot.getTime()}`) ?? null;

  // Obrir qualsevol diàleg tanca el que hi hagi obert a fora (el panell de
  // revisió). Una intenció a la pantalla, i sempre la que s'acaba de clicar.
  const openBook = (b: NonNullable<typeof book>) => {
    onDialogOpen?.();
    setBook(b);
  };
  const openOwn = (o: CellItem & { kind: "own" }) => {
    onDialogOpen?.();
    setOwn(o);
  };
  const openWait = (w: NonNullable<typeof wait>) => {
    onDialogOpen?.();
    setWait(w);
  };

  // Vista por defecto según el ancho de pantalla (móvil = diaria).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768)
      setView("day");
  }, []);

  const trainerName = (id: string | null) =>
    trainers.find((x) => x.id === id)?.name ?? t("professional");

  // Índex de reserves per trainer|data|SLOT, i quins slots queden TAPATS per
  // una sessió que va començar abans. Una sessió d'una hora n'ocupa dos: si el
  // segon es pintés lliure, el client hi clicaria i el servidor el rebutjaria
  // per solapament.
  const { resIndex, coveredIndex } = useMemo(() => {
    const m = new Map<string, ClientCenterData["reservations"]>();
    const cov = new Set<string>();
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      const d = new Date(r.scheduledAt);
      const base = `${r.trainerId}|${localDateStr(d)}`;
      const s = localSlotOf(d);
      const key = `${base}|${s}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push(r);
      for (let i = 1; i < SLOTS_PER_SESSION; i++) cov.add(`${base}|${s + i}`);
    }
    return { resIndex: m, coveredIndex: cov };
  }, [reservations]);

  // Qui ocupa cada franja: com al servidor, només les reserves 'booked'. Les
  // proves actives ja arriben com a reserves 'booked'.
  const occupancy = useMemo(
    () =>
      occupancyFromSessions(
        reservations
          .filter((r) => r.status === "booked")
          .map((r) => ({
            trainerId: r.trainerId,
            scheduledAt: r.scheduledAt,
            serviceType: r.serviceType,
          })),
      ),
    [reservations],
  );

  // Días visibles.
  const days = useMemo(() => {
    if (view === "week") {
      const ws = addDays(startOfWeek(new Date()), offset * 7);
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    const d = addDays(new Date(), offset);
    d.setHours(0, 0, 0, 0);
    return [d];
  }, [view, offset]);

  // Rang de files, ja en slots de mitja hora.
  const slots = useMemo(() => {
    let min = hourToSlot(openingHour);
    let max = hourToSlot(closingHour);
    for (const r of rules) {
      min = Math.min(min, r.startSlot);
      max = Math.max(max, r.endSlot);
    }
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      const s = localSlotOf(new Date(r.scheduledAt));
      min = Math.min(min, s);
      max = Math.max(max, s + SLOTS_PER_SESSION);
    }
    const out: number[] = [];
    for (let s = min; s < max; s++) out.push(s);
    return out;
  }, [rules, reservations, openingHour, closingHour]);

  // Servicios que puede reservar (bonos), respetando el filtro de servicio.
  const canBook = (s: ServiceType) =>
    bonoTypes.includes(s) && (serviceFilter === "all" || serviceFilter === s);
  // I amb qui: individual i parelles, només amb l'entrenador assignat; grup i
  // fisio, amb qualsevol que els ofereixi. La mateixa regla que el servidor
  // (`lib/booking-scope.ts`), perquè la graella no ofereixi el que després
  // es rebutjaria.
  const canBookWith = (s: ServiceType, trainerId: string) =>
    canBook(s) &&
    clientBookingScope({ serviceType: s, trainerId, assignedTrainerId }) === "ok";
  // Té bons d'individual o parelles però cap entrenador: la graella no li'n
  // pot ensenyar cap, i cal dir-li per què en comptes d'un calendari buit.
  const lacksTrainer =
    !assignedTrainerId && bonoTypes.some((s) => requiresAssignedTrainer(s));
  const showTrainer = (id: string | null) =>
    trainerFilter === "all" || trainerFilter === id;

  /** Calcula los chips de una celda (fecha, slot de media hora). */
  function cellItems(date: Date, slot: number): CellItem[] {
    const cellDate = new Date(date);
    cellDate.setHours(0, slot * SLOT_MINUTES, 0, 0);
    const inFuture = cellDate.getTime() > Date.now();
    // La sessió sencera ha de cabre dins de l'horari del centre, no només el
    // seu primer mitja hora: amb graella de mitja hora, començar a les 21:30
    // amb el centre tancant a les 22:00 deixaria mitja sessió fora.
    const inHours =
      slot >= hourToSlot(openingHour) &&
      slot + SLOTS_PER_SESSION <= hourToSlot(closingHour);
    const day = localDateStr(cellDate);
    const items: CellItem[] = [];

    // Si ja tens una reserva que es trepitjaria amb aquesta, no mostris noves
    // franges lliures. Abans es comparava l'hora sencera; ara, el solapament:
    // amb una sessió teva a les 9:30, les 10:00 tampoc et serveixen.
    const clientAlreadyBookedThisHour = reservations.some((r) => {
      if (!r.isOwn || r.status === "cancelled") return false;
      const d = new Date(r.scheduledAt);
      if (localDateStr(d) !== day) return false;
      const s = localSlotOf(d);
      return slot < s + SLOTS_PER_SESSION && s < slot + SLOTS_PER_SESSION;
    });

    for (const t of trainers) {
      if (!showTrainer(t.id)) continue;
      // Tapada per una sessió que va començar abans: aquí no hi comença res.
      if (coveredIndex.has(`${t.id}|${day}|${slot}`)) continue;
      const resHere = resIndex.get(`${t.id}|${day}|${slot}`) ?? [];
      const ownHere = resHere.filter((r) => r.isOwn);
      const exclusive = resHere.find((r) => r.serviceType !== "grupo_reducido");
      const groupHere = resHere.filter(
        (r) => r.serviceType === "grupo_reducido",
      );
      // El que s'hi pot reservar de NOU, amb la regla del servidor
      // (lib/free-slots.ts): regles, bloquejos i tot el que es trepitja amb
      // l'hora sencera. Abans només es mirava la regla, i una sessió que
      // començava a la segona mitja hora (dissabte 10:30) deixava les 10:00
      // "lliures" per a un servidor que després deia que no.
      const offered = freeServicesAt({
        rules,
        blocks,
        trainerId: t.id,
        date: cellDate,
        slot,
        durationMinutes: SESSION_DURATION_MINUTES,
        occupancy,
      });

      // Els noms només existeixen a les reserves de grup: el servidor no els
      // envia per a cap altre servei (vegeu `mateName` a client-calendar.ts).
      const groupMates = (exclude?: string) =>
        groupHere
          .filter((r) => r.id !== exclude)
          .map((r) => r.mateName)
          .filter((n): n is string => !!n);

      // Mis sesiones (siempre visibles).
      for (const r of ownHere)
        items.push({
          kind: "own",
          id: r.id,
          trainerId: t.id,
          service: r.serviceType,
          slot: new Date(r.scheduledAt),
          groupCount: r.serviceType === "grupo_reducido" ? groupHere.length : undefined,
          mates:
            r.serviceType === "grupo_reducido" ? groupMates(r.id) : undefined,
        });
      if (ownHere.length > 0) continue;

      // Ocupado en exclusiva por otra persona.
      if (exclusive) {
        items.push({
          kind: "occupied",
          trainerId: t.id,
          service: exclusive.serviceType,
        });
        continue;
      }

      // Grupo en marcha.
      if (groupHere.length > 0) {
        const count = groupHere.length;
        const hasFree = count < GROUP_CAPACITY;
        const pot =
          inFuture &&
          inHours &&
          canBookWith("grupo_reducido", t.id) &&
          !clientAlreadyBookedThisHour;
        items.push({
          kind: "group",
          trainerId: t.id,
          count,
          joinable: hasFree && pot,
          // Les mateixes condicions, però amb la sessió plena: si podries
          // reservar-la si hi hagués lloc, també pots fer cua.
          waitlistable: !hasFree && pot,
          mates: groupMates(),
          slot: new Date(groupHere[0].scheduledAt),
        });
        continue;
      }

      // Profesional libre: una franja reservable por cada servicio ofrecido
      // para el que el cliente tenga bono.
      if (inFuture && inHours && !clientAlreadyBookedThisHour) {
        for (const s of SERVICE_TYPES) {
          if (offered.has(s) && canBookWith(s, t.id))
            items.push({
              kind: "free",
              trainerId: t.id,
              service: s,
              slot: cellDate,
            });
        }
      }
    }
    return items;
  }

  /**
   * `locale` a les dependències NO és una formalitat del linter.
   *
   * Aquest text ("setembre de 2026", "dimarts 9 de setembre") el formata
   * `Intl` amb l'idioma de qui mira, i `days` està memoritzat a la seva vegada
   * sobre `[view, offset]`: en canviar d'idioma, la seva REFERÈNCIA no es mou.
   * Sense `locale` aquí, doncs, cap de les dues dependències canviava i el
   * memo tornava el valor vell: el calendari es traduïa sencer menys aquesta
   * capçalera, que es quedava en l'idioma anterior fins que la persona
   * canviava de vista o de setmana.
   */
  const periodLabel = useMemo(() => {
    if (view === "week") {
      return new Intl.DateTimeFormat(intlLocale(locale), {
        month: "long",
        year: "numeric",
      }).format(days[0]);
    }
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(days[0]);
  }, [view, days, locale]);

  const shownTrainers = trainers.filter((t) => showTrainer(t.id));

  // Avís si el professional filtrat no ofereix cap servei que el client pugui reservar.
  const filteredTrainerOffersNothing =
    trainerFilter !== "all" &&
    bonoTypes.length > 0 &&
    !rules.some(
      (r) => r.trainerId === trainerFilter && r.serviceTypes.some((s) => bonoTypes.includes(s)),
    );

  return (
    <div>
      {bonoTypes.length === 0 && (
        <p className="mb-4 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-muted">
          {t("noBonos")}
        </p>
      )}

      {lacksTrainer && (
        <div
          role="status"
          data-testid="no-assigned-trainer"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p className="font-bold">{t("noTrainer.title")}</p>
          <p className="mt-0.5">
            {bonoTypes.some((s) => !requiresAssignedTrainer(s))
              ? t("noTrainer.bodyOthers")
              : t("noTrainer.bodyOnly")}
          </p>
        </div>
      )}

      {filteredTrainerOffersNothing && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("noServicesHere")}{" "}
          <button
            type="button"
            onClick={() => setTrainerFilter("all")}
            className={`font-bold underline hover:no-underline active:opacity-70 ${TAP}`}
          >
            {t("showAllTrainers")}
          </button>
        </p>
      )}

      {/* Controles: vista + filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-brand-border">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setOffset(0);
              }}
              className={clsx(
                "px-3 py-1.5 text-sm font-bold",
                TAP,
                view === v
                  ? "bg-brand-purple text-white active:bg-brand-purple-dark"
                  : "bg-white text-brand-muted hover:text-brand-dark active:bg-brand-bg",
              )}
            >
              {v === "day" ? t("day") : t("week")}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-bold tracking-wide text-brand-muted uppercase">
            {t("service")}
          </span>
          <select
            value={serviceFilter}
            onChange={(e) =>
              setServiceFilter(e.target.value as ServiceType | "all")
            }
            className="rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple"
          >
            <option value="all">{t("all")}</option>
            {SERVICE_TYPES.filter((s) => bonoTypes.includes(s)).map((s) => (
              <option key={s} value={s}>
                {tl(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-bold tracking-wide text-brand-muted uppercase">
            {t("professional")}
          </span>
          <select
            value={trainerFilter}
            onChange={(e) => setTrainerFilter(e.target.value)}
            className="rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-purple"
          >
            <option value="all">{t("all")}</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Leyenda de profesionales */}
      {shownTrainers.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {shownTrainers.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1.5 text-xs font-bold text-brand-charcoal"
            >
              {/* La foto substitueix el punt de color; sense foto, el punt
                  segueix sent el cercle amb la inicial del seu color. */}
              <Avatar
                name={t.name}
                url={t.avatarUrl}
                size={18}
                color={colorOfPro(palette, t.id)}
              />
              {firstName(t.name)}
            </span>
          ))}
        </div>
      )}

      {/* Navegación */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* No es va més enrere de la setmana d'avui: el calendari és per
              reservar, i l'historial és a "Sessions passades". El servidor
              tampoc no porta res d'abans (vegeu `getClientCenterData`). */}
          <NavBtn
            label={t("prev")}
            disabled={offset <= minOffset}
            onClick={() => setOffset((o) => Math.max(minOffset, o - 1))}
          >
            ‹
          </NavBtn>
          <button
            type="button"
            onClick={() => setOffset(0)}
            className={`rounded-lg border border-brand-border bg-white px-3 py-1.5 text-sm font-bold text-brand-charcoal hover:bg-brand-bg active:bg-brand-border ${TAP}`}
          >
            {t("today")}
          </button>
          <NavBtn label={t("next")} onClick={() => setOffset((o) => o + 1)}>
            ›
          </NavBtn>
        </div>
        <span className="text-sm font-bold text-brand-dark first-letter:uppercase">
          {periodLabel}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <div className={view === "week" ? "min-w-[56rem]" : ""}>
          <div
            className="grid border-b border-brand-border"
            style={{
              gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)`,
            }}
          >
            <div className="bg-brand-bg" />
            {days.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={clsx(
                    "border-l border-brand-border px-2 py-2 text-center",
                    isToday ? "bg-brand-purple/5" : "bg-brand-bg",
                  )}
                >
                  <div className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                    {t(`days.${weekdayOf(d)}`)}
                  </div>
                  <div
                    className={clsx(
                      "text-sm font-bold",
                      isToday ? "text-brand-purple" : "text-brand-dark",
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Files de mitja hora. Només la fila en punt porta etiqueta, i la
              línia del mig és més fluixa: cada hora es llegeix com un bloc amb
              dues meitats, no com dues files soltes. */}
          {slots.map((slot) => (
            <div
              key={slot}
              className={clsx(
                "grid border-b last:border-0",
                isOnTheHour(slot) ? "border-brand-border/30" : "border-brand-border",
              )}
              style={{
                gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)`,
              }}
            >
              <div className="px-1 py-2 text-right text-xs font-bold text-brand-muted">
                {isOnTheHour(slot) ? slotToHHMM(slot) : ""}
              </div>
              {days.map((d, dayIdx) => {
                const items = cellItems(d, slot);
                return (
                  <div
                    key={dayIdx}
                    className="min-h-[2.25rem] border-l border-brand-border p-1 align-top"
                  >
                    <div className="flex flex-col gap-1">
                      {items.map((it, idx) => {
                        if (it.kind === "own") {
                          // Verd propi coherent amb el semàfor de grups (#16a34a = green-600)
                          const ownBg = "#dcfce7"; // green-100
                          const ownBorder = "#16a34a"; // green-600
                          return (
                            <button
                              key={`own-${it.id}`}
                              type="button"
                              onClick={() => openOwn(it)}
                              style={{
                                backgroundColor: ownBg,
                                border: `2px solid ${ownBorder}`,
                              }}
                              className={`block w-full min-w-0 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight active:bg-brand-bg ${TAP}`}
                            >
                              <span className="flex min-w-0 items-center gap-0.5 font-bold" style={{ color: ownBorder }}>
                                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"><polyline points="1.5 5 4 7.5 8.5 2" /></svg>
                                <span className="shrink-0">{SVC_ICON[it.service]}</span>
                                <span className="truncate">{tb(it.service)}{it.groupCount != null ? ` · ${it.groupCount}/${GROUP_CAPACITY}` : ""}</span>
                              </span>
                              <span className="block truncate text-brand-muted">
                                {firstName(trainerName(it.trainerId))}
                              </span>
                            </button>
                          );
                        }
                        if (it.kind === "occupied") {
                          return (
                            <span
                              key={`occ-${idx}`}
                              className="flex items-center gap-0.5 rounded-md bg-brand-border/50 px-1.5 py-1 text-[11px] leading-tight text-brand-muted"
                            >
                              <span className="shrink-0 opacity-60">{SVC_ICON[it.service]}</span>
                              {t("occupied")}
                            </span>
                          );
                        }
                        if (it.kind === "group") {
                          // L'ocupació ja no tenyeix la fitxa, només l'explica:
                          // el color diu que això és un grup i el text diu quant
                          // de ple està. Mateix criteri que a l'agenda de
                          // l'equip.
                          const status = getOccupancyStatus(it.count);
                          const groupColor = colorOfService(
                            palette,
                            "grupo_reducido",
                          );
                          // Plena però amb cua oberta: la fitxa deixa de ser un
                          // carreró sense sortida i obre el diàleg d'espera.
                          const canWait = waitlistEnabled && it.waitlistable;
                          const waiting = waitingAt(it.trainerId, it.slot);
                          return (
                            <button
                              key={`grp-${idx}`}
                              type="button"
                              disabled={!it.joinable && !canWait}
                              onClick={
                                it.joinable
                                  ? () =>
                                      openBook({
                                        trainerId: it.trainerId!,
                                        service: "grupo_reducido",
                                        slot: it.slot,
                                        mates: it.mates,
                                      })
                                  : canWait
                                    ? () =>
                                        openWait({
                                          trainerId: it.trainerId!,
                                          slot: it.slot,
                                          entryId: waiting,
                                        })
                                    : undefined
                              }
                              style={{
                                backgroundColor: `${groupColor}1a`,
                                borderLeft: `3px solid ${groupColor}`,
                              }}
                              className={clsx(
                                "block w-full rounded-md px-1.5 py-1 text-left text-[11px] font-bold leading-tight",
                                it.joinable || canWait
                                  ? `cursor-pointer hover:brightness-95 active:brightness-90 ${TAP}`
                                  : "cursor-not-allowed opacity-80",
                              )}
                            >
                              <span className="block" style={{ color: groupColor }}>
                                {tb("grupo_reducido")} · {it.count}/
                                {GROUP_CAPACITY}
                              </span>
                              {/* L'estat en gris i no en el color del grup: el
                                  color ja diu què és, i aquesta línia és la que
                                  diu si hi cabries. Separar-ho evita que tota la
                                  fitxa sigui una sola taca taronja. */}
                              <span className="block font-normal text-brand-muted">
                                {waiting
                                  ? t("group.onList")
                                  : status === "full"
                                    ? canWait
                                      ? t("group.fullQueue")
                                      : t("group.full")
                                    : status === "almost_full"
                                      ? t("group.almostFull")
                                      : t("group.free")}
                              </span>
                            </button>
                          );
                        }
                        // free
                        /**
                         * El color d'una franja lliure: de qui la té, EXCEPTE
                         * als grups.
                         *
                         * A la resta de serveis el color diu amb qui aniràs, i
                         * per això és el del professional. En un grup no informa
                         * de res útil i sí que despista: la mateixa classe
                         * canviava de color segons qui la porta, i costava
                         * veure-les com una sola cosa. Un grup és un grup, el
                         * faci qui el faci; el nom de qui el porta segueix
                         * escrit a sota de la fitxa.
                         *
                         * El color surt de la paleta de serveis que ja existeix
                         * (Configuració → Colors → «Grup reduït»), de manera que
                         * es canvia des de la mateixa pantalla que la resta.
                         */
                        const color =
                          it.service === "grupo_reducido"
                            ? colorOfService(palette, it.service)
                            : colorOfPro(palette, it.trainerId);
                        return (
                          <button
                            key={`free-${it.trainerId}-${it.service}`}
                            type="button"
                            onClick={() =>
                              openBook({
                                trainerId: it.trainerId,
                                service: it.service,
                                slot: it.slot,
                              })
                            }
                            style={{
                              backgroundColor: `${color}12`,
                              borderLeft: `3px solid ${color}`,
                            }}
                            className={`block w-full cursor-pointer rounded-md px-1.5 py-1 text-left text-[11px] leading-tight hover:brightness-95 active:brightness-90 ${TAP}`}
                          >
                            <span
                              className="flex items-center gap-0.5 font-bold"
                              style={{ color }}
                            >
                              <span className="shrink-0">{SVC_ICON[it.service]}</span>
                              {tb(it.service)}
                            </span>
                            <span className="block truncate text-brand-muted">
                              {firstName(trainerName(it.trainerId))}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        {t("legend")}
      </p>

      {/* Sense `seed` no hi ha repetició possible. És el que tanca LES DUES
          portes del bucle —la casella «Fer-ho recurrent» d'aquest diàleg i el
          botó «Repetir en bucle» del de sota— amb una sola regla i sense tocar
          ni una línia de cap dels dos. Les de grup no en tenen mai: quatre
          places ocupades en bucle per la mateixa persona és exactament el que
          no pot passar (vegeu `lib/series-rules.ts`). */}
      {book && (
        <CreateModal
          trainerId={book.trainerId}
          otherPartyName={trainerName(book.trainerId)}
          service={book.service}
          slot={book.slot}
          mates={book.mates}
          seed={
            canRepeatInSeries(book.service)
              ? {
                  scheduledAt: book.slot.toISOString(),
                  trainerId: book.trainerId,
                  trainerName: trainerName(book.trainerId),
                  serviceType: book.service,
                }
              : undefined
          }
          remainingSessions={data.bonoSessions[book.service]}
          waitlistEnabled={waitlistEnabled}
          subscriptionServiceType={subscriptionServiceType}
          onSeriesReady={
            onSeriesReady
              ? (review) => {
                  // El diàleg deixa pas al panell de revisió: mai els dos.
                  setBook(null);
                  onSeriesReady(review);
                }
              : undefined
          }
          action={createAction}
          onClose={() => setBook(null)}
          onDone={() => {
            setBook(null);
            router.refresh();
          }}
        />
      )}

      {own && (
        <OwnModal
          service={own.service}
          otherPartyName={trainerName(own.trainerId)}
          mates={own.mates}
          id={own.id}
          scheduledAt={own.slot.toISOString()}
          minCancellationHours={minCancellationHours}
          cancelAction={cancelAction}
          seed={
            own.trainerId && canRepeatInSeries(own.service)
              ? {
                  scheduledAt: own.slot.toISOString(),
                  trainerId: own.trainerId,
                  trainerName: trainerName(own.trainerId),
                  serviceType: own.service,
                }
              : undefined
          }
          remainingSessions={data.bonoSessions[own.service]}
          waitlistEnabled={waitlistEnabled}
          subscriptionServiceType={subscriptionServiceType}
          onSeriesReady={
            onSeriesReady
              ? (review) => {
                  setOwn(null);
                  onSeriesReady(review);
                }
              : undefined
          }
          onClose={() => setOwn(null)}
        />
      )}

      {wait && (
        <WaitlistModal
          trainerName={trainerName(wait.trainerId)}
          slot={wait.slot}
          trainerId={wait.trainerId}
          entryId={wait.entryId}
          onClose={() => setWait(null)}
          onDone={() => {
            setWait(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NavBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-white text-lg font-bold text-brand-charcoal hover:bg-brand-bg active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 ${TAP}`}
    >
      {children}
    </button>
  );
}
