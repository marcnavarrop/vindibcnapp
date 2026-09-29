"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { clsx, TAP } from "@/lib/utils";
import { GROUP_CAPACITY, SERVICE_TYPES, formatDayHeading, formatTime } from "@/lib/labels";
import { weekdayOfDay } from "@/lib/availability-slots";
import { canCancelAt } from "@/lib/cancellation";
import {
  countsFor,
  hoursFor,
  lacksTrainerFor,
  prepare,
  stripDays,
  upcomingOwn,
  type HourRow,
  type SlotReservation,
} from "@/lib/client-day-slots";
import { colorOfPro, colorOfService, type ColorPalette } from "@/lib/colors";
import { Avatar } from "@/components/ui/avatar";
import { SVC_ICON } from "@/components/client/service-icons";
import {
  CreateModal,
  OwnModal,
  WaitlistModal,
  type CreateAction,
  type CancelAction,
} from "@/components/client/booking-dialogs";
import type { ClientCenterData } from "@/lib/data/client-calendar";
import type { ServiceType } from "@/types/database";
import type { Locale } from "@/lib/i18n/config";
import { centerDateStr } from "@/lib/center-time";

/**
 * Reserves del client, versió llista (C2 · direcció A amb la capçalera de B).
 *
 *   1. Què vols reservar? — els serveis dels teus bons, amb les sessions que
 *      et queden.
 *   2. Quin dia? — d'avui en endavant, i cada dia diu quantes hores té.
 *   3. A quina hora? — la llista d'hores lliures, grans i tocables. Els grups
 *      diuen com van de plens, i si són plens, ofereixen la cua.
 *
 * Tocar una hora obre la fulla de confirmar (quin bo es gasta, repetir-la, i a
 * fisio, amb qui). Tot el que decideix què surt viu a `lib/client-day-slots.ts`,
 * amb la regla del servidor i la d'amb qui de C1.
 *
 * SENSE ERRORS D'HIDRATACIÓ
 *
 * Tot es compta en hora del centre, amb l'instant `nowISO` i el dia `today`
 * que envia el servidor: la primera passada (al servidor, en UTC) i la del
 * navegador pinten exactament el mateix. És el que no feia la graella, i el que
 * provocava l'error #418.
 */

/** Quants dies ensenya la tira: d'avui a tres setmanes vista. */
export const STRIP_DAYS = 21;
/** Les properes que surten de cop a la capçalera; la resta, amb «Veure-les totes». */
const UPCOMING_SHOWN = 3;

const firstName = (name: string) => name.split(" ")[0];

/**
 * «Dc 30 de set. · 10:00», en hora del centre. Curt a propòsit: al mòbil la
 * versió llarga («Dimecres, 30 de setembre») no hi cabia i es tallava.
 *
 * El dia i el mes surten del DICCIONARI i no d'`Intl`: aquesta línia es pinta
 * al servidor i al navegador, i el format curt d'`Intl` no és igual als dos
 * motors (en anglès, Node escriu «Fri 2 Oct» i Chrome «Fri, 2 Oct»). Aquella
 * coma de diferència ja és un error d'hidratació #418.
 */
function useShortWhen() {
  const t = useTranslations("reservas.list");
  const tr = useTranslations("reservas");
  const locale = useLocale() as Locale;
  const days = tr.raw("days") as string[];
  const months = t.raw("months") as string[];
  return (iso: string) => {
    const day = centerDateStr(new Date(iso));
    const date = t("shortDate", {
      weekday: days[weekdayOfDay(day)],
      day: Number(day.slice(8)),
      month: months[Number(day.slice(5, 7)) - 1],
    });
    return `${date} · ${formatTime(iso, locale)}`;
  };
}

type Common = {
  data: ClientCenterData;
  palette: ColorPalette;
  nowISO: string;
  minCancellationHours: number;
  cancelAction: CancelAction;
  waitlistEnabled: boolean;
  subscriptionServiceType: ServiceType | null;
};

/**
 * La capçalera: les teves properes sessions (amb «Cancel·lar» a mà) i els bons
 * que et queden. Surt a totes les amplades.
 */
export function MyBookingsHeader({
  data,
  palette,
  nowISO,
  minCancellationHours,
  cancelAction,
  subscriptionServiceType,
  waitlistEnabled,
}: Common) {
  const t = useTranslations("reservas.list");
  const tl = useTranslations("labels.service");
  const tr = useTranslations("reservas");
  const nowMs = new Date(nowISO).getTime();
  const shortWhen = useShortWhen();
  const [all, setAll] = useState(false);
  const [own, setOwn] = useState<{ r: SlotReservation; confirm: boolean } | null>(null);
  const upcoming = useMemo(() => upcomingOwn(data.reservations, nowMs), [data.reservations, nowMs]);
  const shown = all ? upcoming : upcoming.slice(0, UPCOMING_SHOWN);
  const trainerName = (id: string | null) =>
    data.trainers.find((x) => x.id === id)?.name ?? tr("professional");
  const bonos = SERVICE_TYPES.filter((s) => (data.bonoSessions[s] ?? 0) > 0);

  return (
    <section aria-labelledby="my-bookings" className="flex flex-col gap-3">
      <h2 id="my-bookings" className="text-xs font-bold tracking-wide text-brand-muted uppercase">
        {t("upcoming")}
      </h2>
      {upcoming.length === 0 ? (
        <p className="rounded-xl border border-brand-border bg-white px-4 py-3 text-sm text-brand-muted">
          {t("noUpcoming")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="upcoming">
          {shown.map((r, i) => {
            const cancellable = canCancelAt(r.scheduledAt, minCancellationHours, nowMs);
            return (
              <li
                key={r.id}
                className={clsx(
                  // A l'escriptori la columna és estreta: «Cancel·lar» baixa a una
                  // segona línia perquè la data es llegeixi sencera.
                  "flex items-center gap-3 rounded-xl border px-3 py-2 lg:flex-wrap lg:gap-y-0",
                  i === 0 ? "border-green-200 bg-green-50" : "border-brand-border bg-white",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOwn({ r, confirm: false });
                  }}
                  className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left lg:basis-full ${TAP}`}
                >
                  <Avatar
                    name={trainerName(r.trainerId)}
                    url={data.trainers.find((x) => x.id === r.trainerId)?.avatarUrl ?? null}
                    size={32}
                    color={colorOfPro(palette, r.trainerId)}
                    className="lg:hidden"
                  />
                  <span className="min-w-0">
                    {i === 0 && (
                      <span className="block text-[11px] font-bold tracking-wide text-green-700 uppercase">
                        {t("next")}
                      </span>
                    )}
                    <span className="block truncate text-sm font-bold text-brand-dark first-letter:uppercase">
                      {shortWhen(r.scheduledAt)}
                    </span>
                    <span className="block truncate text-xs text-brand-muted">
                      {tl(r.serviceType)} · {firstName(trainerName(r.trainerId))}
                    </span>
                  </span>
                </button>
                {cancellable ? (
                  <button
                    type="button"
                    onClick={() => {
                        setOwn({ r, confirm: true });
                    }}
                    className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-bold text-error hover:bg-error/10 active:bg-error/20 lg:ml-auto ${TAP}`}
                  >
                    {t("cancel")}
                  </button>
                ) : (
                  <span className="max-w-[6rem] shrink-0 text-right text-[11px] leading-tight text-brand-muted lg:ml-auto lg:max-w-none lg:pb-1">
                    {t("cantCancel")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {upcoming.length > UPCOMING_SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className={`min-h-11 self-start rounded-lg px-2 text-sm font-bold text-brand-purple active:bg-brand-bg ${TAP}`}
        >
          {all ? t("seeLess") : t("seeAll", { count: upcoming.length })}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="bonos">
        <span className="font-bold text-brand-charcoal">{t("left")}</span>
        {bonos.length === 0 ? (
          <span className="text-brand-muted">{t("noBonosShort")}</span>
        ) : (
          bonos.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-brand-charcoal">
              <span style={{ color: colorOfService(palette, s) }}>{SVC_ICON[s]}</span>
              {tl(s)} · <b>{data.bonoSessions[s]}</b>
            </span>
          ))
        )}
        <Link
          href="/client/bonos"
          className={`inline-flex min-h-11 items-center font-bold text-brand-purple underline-offset-2 hover:underline ${TAP}`}
        >
          {t("myBonos")}
        </Link>
      </div>

      {own && (
        <OwnModal
          service={own.r.serviceType}
          otherPartyName={trainerName(own.r.trainerId)}
          mates={
            own.r.serviceType === "grupo_reducido"
              ? data.reservations
                  .filter(
                    (x) =>
                      !x.isOwn &&
                      x.status === "booked" &&
                      x.trainerId === own.r.trainerId &&
                      x.serviceType === "grupo_reducido" &&
                      new Date(x.scheduledAt).getTime() === new Date(own.r.scheduledAt).getTime(),
                  )
                  .map((x) => x.mateName)
                  .filter((n): n is string => !!n)
              : []
          }
          id={own.r.id}
          scheduledAt={own.r.scheduledAt}
          minCancellationHours={minCancellationHours}
          cancelAction={cancelAction}
          startConfirming={own.confirm}
          trainerId={own.r.trainerId}
          subscriptionServiceType={subscriptionServiceType}
          waitlistEnabled={waitlistEnabled}
          onClose={() => setOwn(null)}
        />
      )}
    </section>
  );
}

/** Servei → dia → hores. La pantalla principal al mòbil. */
export function ReservasList({
  data,
  palette,
  nowISO,
  today,
  minBookingHours,
  minCancellationHours,
  openingHour,
  closingHour,
  createAction,
  cancelAction,
  waitlistEnabled,
  subscriptionServiceType,
  waitlist,
}: Common & {
  /** Avui, en hora del centre (YYYY-MM-DD). Arriba del servidor. */
  today: string;
  minBookingHours: number;
  openingHour: number;
  closingHour: number;
  createAction: CreateAction;
  waitlist: { id: string; trainerId: string | null; desiredAt: string }[];
}) {
  const router = useRouter();
  const t = useTranslations("reservas.list");
  const tr = useTranslations("reservas");
  const tl = useTranslations("labels.service");
  const tb = useTranslations("reservas.serviceBadge");
  const locale = useLocale() as Locale;
  const dayNames = tr.raw("days") as string[];
  const nowMs = new Date(nowISO).getTime();

  const prepared = useMemo(
    () =>
      prepare({
        rules: data.rules,
        blocks: data.blocks,
        trainerIds: data.trainers.map((x) => x.id),
        reservations: data.reservations,
        assignedTrainerId: data.assignedTrainerId,
        nowMs,
        minBookingHours,
        openingHour,
        closingHour,
        waitlistEnabled,
        waitlist,
      }),
    [data, nowMs, minBookingHours, openingHour, closingHour, waitlistEnabled, waitlist],
  );
  const days = useMemo(() => stripDays(today, STRIP_DAYS), [today]);

  // Els serveis que pot reservar: els dels seus bons. Primer, un que pugui fer
  // de debò (sense entrenador, l'individual no li serveix de primera).
  const services = SERVICE_TYPES.filter((s) => data.bonoTypes.includes(s));
  const firstUsable =
    services.find((s) => !lacksTrainerFor(s, data.assignedTrainerId)) ?? services[0] ?? null;
  const [service, setService] = useState<ServiceType | null>(firstUsable);

  const counts = useMemo(
    () => (service ? countsFor(prepared, days, service) : {}),
    [prepared, days, service],
  );
  const firstWithHours = days.find((d) => (counts[d] ?? 0) > 0) ?? today;
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day = pickedDay && days.includes(pickedDay) ? pickedDay : firstWithHours;
  const rows = useMemo(
    () => (service ? hoursFor(prepared, day, service) : []),
    [prepared, day, service],
  );

  const [book, setBook] = useState<{
    trainerIds: string[];
    service: ServiceType;
    at: string;
    mates: string[];
  } | null>(null);
  const [wait, setWait] = useState<{ trainerId: string; at: string; entryId: string | null } | null>(null);
  const [own, setOwn] = useState<(HourRow & { kind: "own" }) | null>(null);

  const trainer = (id: string | null) => data.trainers.find((x) => x.id === id);
  const trainerName = (id: string | null) => trainer(id)?.name ?? tr("professional");
  const open = (fn: () => void) => {
    fn();
  };

  if (services.length === 0)
    return (
      <div className="rounded-xl border border-brand-border bg-white p-4">
        <p className="text-sm text-brand-muted">{tr("noBonos")}</p>
        <Link
          href="/client/bonos"
          className={`mt-3 inline-flex min-h-11 items-center rounded-lg bg-brand-purple px-4 text-sm font-bold text-white active:bg-brand-purple-dark ${TAP}`}
        >
          {t("buyBono")}
        </Link>
      </div>
    );

  const lacks = service ? lacksTrainerFor(service, data.assignedTrainerId) : false;
  const nextDayWithHours = days.find((d) => d > day && (counts[d] ?? 0) > 0);
  const morning = rows.filter((r) => r.hhmm < "14:00");
  const afternoon = rows.filter((r) => r.hhmm >= "14:00");

  return (
    <div className="flex flex-col gap-5 lg:contents" data-testid="reservas-list">
      {/* 1. Què vols reservar? */}
      <section aria-labelledby="step-service" className="lg:col-start-2 lg:row-start-1">
        <h2 id="step-service" className="mb-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
          {t("stepService")}
        </h2>
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
          role="group"
          aria-labelledby="step-service"
        >
          {services.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === service}
              onClick={() => {
                setService(s);
                setPickedDay(null);
              }}
              className={clsx(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold whitespace-nowrap",
                TAP,
                s === service
                  ? "border-brand-purple bg-brand-purple text-white"
                  : "border-brand-border bg-white text-brand-charcoal active:bg-brand-bg",
              )}
            >
              <span aria-hidden>{SVC_ICON[s]}</span>
              <span title={tl(s)}>{tb(s)}</span>
              <span className={clsx("font-normal", s === service ? "text-white/80" : "text-brand-muted")}>
                · {data.bonoSessions[s] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </section>

      {lacks ? (
        <div
          role="status"
          data-testid="no-assigned-trainer"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:col-span-2 lg:col-start-2 lg:row-start-2"
        >
          <p className="font-bold">{tr("noTrainer.title")}</p>
          <p className="mt-1">
            {data.bonoTypes.some((s) => !lacksTrainerFor(s, null))
              ? tr("noTrainer.bodyOthers")
              : tr("noTrainer.bodyOnly")}
          </p>
        </div>
      ) : (
        <>
          {/* 2. Quin dia? */}
          <section aria-labelledby="step-day" className="lg:col-start-2 lg:row-start-2">
            <h2 id="step-day" className="mb-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
              {t("stepDay")}
            </h2>
            {/* Al mòbil, una tira que llisca. A l'escriptori, un calendari de tres
                setmanes: set columnes, amb els dies passats d'aquesta setmana
                com a buits perquè cada dia caigui sota el seu nom. */}
            <div
              className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-7 lg:gap-1 lg:overflow-visible lg:px-0"
              data-testid="day-strip"
            >
              {Array.from({ length: weekdayOfDay(today) }, (_, i) => (
                <span key={`pad-${i}`} aria-hidden className="hidden lg:block" />
              ))}
              {days.map((d) => {
                const n = counts[d] ?? 0;
                const on = d === day;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    data-day={d}
                    aria-label={`${formatDayHeading(`${d}T12:00:00Z`, locale)} · ${t("hours", { count: n })}`}
                    onClick={() => setPickedDay(d)}
                    className={clsx(
                      "flex h-16 w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl border lg:h-14 lg:w-auto lg:rounded-lg",
                      TAP,
                      on
                        ? "border-brand-purple bg-brand-purple text-white"
                        : n > 0
                          ? "border-brand-border bg-white text-brand-dark active:bg-brand-bg"
                          : "border-brand-border bg-brand-bg text-brand-muted",
                    )}
                  >
                    <span className="text-[11px] font-bold uppercase lg:text-[9px]">
                      {d === today ? t("today") : dayNames[weekdayOfDay(d)]}
                    </span>
                    <span className="text-lg leading-tight font-bold lg:text-base">{Number(d.slice(8))}</span>
                    <span className={clsx("text-[10px] font-bold", on ? "text-white/85" : n > 0 ? "text-green-700" : "")}>
                      {/* A l'escriptori la cel·la és estreta: només el número (el
                          text sencer és a l'aria-label). */}
                      <span className="lg:hidden">{n > 0 ? t("hoursShort", { count: n }) : "—"}</span>
                      <span className="hidden lg:inline" aria-hidden>{n > 0 ? n : "—"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. A quina hora? */}
          <section aria-labelledby="step-hour" className="lg:col-start-3 lg:row-span-3 lg:row-start-1">
            <h2 id="step-hour" className="mb-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
              {t("stepHour")}
            </h2>
            <p className="mb-2 text-base font-bold text-brand-dark first-letter:uppercase" data-testid="day-title">
              {formatDayHeading(`${day}T12:00:00Z`, locale)}
            </p>
            {rows.length === 0 ? (
              <div className="rounded-xl border border-brand-border bg-white p-4 text-sm text-brand-muted">
                <p>{t("emptyDay")}</p>
                {nextDayWithHours && (
                  <button
                    type="button"
                    onClick={() => setPickedDay(nextDayWithHours)}
                    className={`mt-2 min-h-11 rounded-lg px-2 font-bold text-brand-purple active:bg-brand-bg ${TAP}`}
                  >
                    {t("goTo", { day: formatDayHeading(`${nextDayWithHours}T12:00:00Z`, locale) })}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4" data-testid="hours">
                {[
                  { label: t("morning"), list: morning },
                  { label: t("afternoon"), list: afternoon },
                ]
                  .filter((g) => g.list.length > 0)
                  .map((g) => (
                    <div key={g.label}>
                      <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-brand-muted uppercase">{g.label}</h3>
                      <ul className="flex flex-col gap-2">
                        {g.list.map((r) => (
                          <li key={`${r.kind}-${r.at}-${r.kind === "free" ? "x" : r.kind === "group" ? r.trainerId : r.reservationId}`}>
                            <HourButton
                              row={r}
                              palette={palette}
                              trainer={trainer}
                              onPick={() =>
                                open(() => {
                                  if (r.kind === "free")
                                    setBook({ trainerIds: r.trainerIds, service: service!, at: r.at, mates: [] });
                                  else if (r.kind === "group" && r.canJoin)
                                    setBook({ trainerIds: [r.trainerId], service: "grupo_reducido", at: r.at, mates: r.mates });
                                  else if (r.kind === "group")
                                    setWait({ trainerId: r.trainerId, at: r.at, entryId: r.waitingEntryId });
                                  else setOwn(r);
                                })
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </>
      )}

      {book && (
        <CreateModal
          trainerId={book.trainerIds[0]}
          otherPartyName={trainerName(book.trainerIds[0])}
          trainerOptions={
            book.trainerIds.length > 1
              ? book.trainerIds.map((id) => ({ id, name: trainerName(id) }))
              : undefined
          }
          service={book.service}
          slot={new Date(book.at)}
          mates={book.mates}
          remainingSessions={data.bonoSessions[book.service]}
          subscriptionServiceType={subscriptionServiceType}
          waitlistEnabled={waitlistEnabled}
          action={createAction}
          onClose={() => setBook(null)}
          onDone={() => {
            setBook(null);
            router.refresh();
          }}
        />
      )}

      {wait && (
        <WaitlistModal
          trainerName={trainerName(wait.trainerId)}
          slot={new Date(wait.at)}
          trainerId={wait.trainerId}
          entryId={wait.entryId}
          onClose={() => setWait(null)}
          onDone={() => {
            setWait(null);
            router.refresh();
          }}
        />
      )}

      {own && (
        <OwnModal
          service={own.service}
          otherPartyName={trainerName(own.trainerId)}
          mates={own.mates}
          id={own.reservationId}
          scheduledAt={own.at}
          minCancellationHours={minCancellationHours}
          cancelAction={cancelAction}
          trainerId={own.trainerId}
          subscriptionServiceType={subscriptionServiceType}
          waitlistEnabled={waitlistEnabled}
          onClose={() => setOwn(null)}
        />
      )}
    </div>
  );
}

/** Una hora de la llista: gran, tocable, i amb el que cal saber d'un cop d'ull. */
function HourButton({
  row,
  palette,
  trainer,
  onPick,
}: {
  row: HourRow;
  palette: ColorPalette;
  trainer: (id: string | null) => { id: string; name: string; avatarUrl: string | null } | undefined;
  onPick: () => void;
}) {
  const t = useTranslations("reservas.list");
  const ids = row.kind === "free" ? row.trainerIds : [row.trainerId];
  const names = ids.map((id) => firstName(trainer(id)?.name ?? "—"));
  const who =
    names.length <= 1
      ? names[0]
      : t("either", { first: names.slice(0, -1).join(", "), last: names[names.length - 1] });

  let status: React.ReactNode = null;
  let action: string | null = null;
  let tone = "border-brand-border bg-white";
  if (row.kind === "own") {
    tone = "border-green-300 bg-green-50";
    status = <span className="font-bold text-green-700">✓ {t("own")}</span>;
  } else if (row.kind === "group") {
    const left = GROUP_CAPACITY - row.count;
    status = (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex gap-0.5" aria-hidden>
          {Array.from({ length: GROUP_CAPACITY }, (_, i) => (
            <span
              key={i}
              className={clsx("h-2 w-2 rounded-full", i < row.count ? "bg-[#ea7a1a]" : "bg-brand-border")}
            />
          ))}
        </span>
        <span className={clsx("font-bold", row.canJoin ? "text-[#b85a0c]" : "text-brand-muted")}>
          {row.waitingEntryId
            ? t("onQueue")
            : row.count === 0
              ? t("groupNew")
              : row.canJoin
                ? t("placesLeft", { count: left })
                : t("full")}
        </span>
      </span>
    );
    if (!row.canJoin) {
      tone = "border-brand-border bg-brand-bg";
      action = row.waitingEntryId ? t("queueOpen") : row.canWait ? t("queue") : null;
    }
  }
  const disabled = row.kind === "group" && !row.canJoin && !row.canWait && !row.waitingEntryId;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      data-hour={row.hhmm}
      data-kind={row.kind}
      className={clsx(
        "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left",
        TAP,
        tone,
        disabled ? "cursor-not-allowed opacity-70" : "active:brightness-95",
      )}
    >
      <span className="w-14 shrink-0 text-lg font-bold text-brand-dark tabular-nums">{row.hhmm}</span>
      <span className="flex shrink-0 -space-x-1.5">
        {ids.slice(0, 3).map((id) => (
          <Avatar
            key={id}
            name={trainer(id)?.name ?? "—"}
            url={trainer(id)?.avatarUrl ?? null}
            size={28}
            color={colorOfPro(palette, id)}
          />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-brand-charcoal">{who}</span>
        {status && <span className="block text-xs">{status}</span>}
      </span>
      {action ? (
        <span className="shrink-0 rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs font-bold text-brand-charcoal">
          {action}
        </span>
      ) : !disabled ? (
        <span className="shrink-0 text-lg text-brand-muted" aria-hidden>›</span>
      ) : null}
    </button>
  );
}
