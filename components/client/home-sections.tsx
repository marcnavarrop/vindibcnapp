import { TAP } from "@/lib/utils";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { Icon, IconBox } from "@/components/ui/home-icon";
import { Badge } from "@/components/ui/badge";
import { ClientAddToCalendarButton } from "@/components/client/client-add-to-calendar-button";
import { CancelReservationButton } from "@/components/forms/cancel-reservation-button";
import { DirectionsLink } from "@/components/client/directions-link";
import { colorOfPro, type ColorPalette } from "@/lib/colors";
import {
  formatDate,
  formatTime,
  formatMonthShort,
  formatRelativeDay,
} from "@/lib/labels";
import { centerDateStr } from "@/lib/center-time";
import type { Locale } from "@/lib/i18n/config";
import type { ClientBono, ClientReservation } from "@/lib/data/clients";
import type { BonoStatus } from "@/types/database";

/**
 * Peces de l'inici del client.
 *
 * Totes són de presentació i només les fa servir aquella pàgina; viuen juntes
 * en un fitxer perquè es llegeixin d'un cop, i fora de la pàgina perquè la
 * pàgina es quedi amb el que fa de debò: demanar les dades i ordenar-les.
 *
 * NOMÉS EL QUE SERVEIX (auditoria de l'Inici, octubre del 2026): la pròxima
 * sessió en gran, «Reservar una sessió» i les sessions que li queden a cada bo,
 * amb «Renovar» quan s'acaba. Les quatre xifres de dalt (sessions, bons,
 * properes, assistència) i les tres dreceres repetien el que ja hi havia a
 * sota o al menú, i la pròxima sessió sortia dues vegades.
 */

// ─────────────────────── Pròxima sessió ───────────────────────

/**
 * La pròxima sessió, en gran: és el que es mira en obrir l'app.
 *
 * Quan (avui / demà / dj. 15 oct. i l'hora en gran), què, amb qui, com arribar,
 * afegir-la al calendari i cancel·lar-la (o «ja no es pot cancel·lar», el
 * mateix botó que a Reserves). Sense cap sessió, ho diu i convida a reservar.
 */
export async function NextSessionHero({
  reservation,
  avatars,
  palette,
  minCancellationHours,
}: {
  reservation: ClientReservation | null;
  avatars: Map<string, string>;
  palette: ColorPalette;
  minCancellationHours: number;
}) {
  const [t, tn, tl, locale] = await Promise.all([
    getTranslations("home"),
    getTranslations("home.next"),
    getTranslations("labels.service"),
    getLocale() as Promise<Locale>,
  ]);

  return (
    <section
      aria-labelledby="next-session"
      className="rounded-2xl border border-brand-purple/20 bg-brand-purple/5 p-5 sm:p-6"
    >
      <h2 id="next-session" className="text-xs font-bold tracking-widest text-brand-purple uppercase">
        {t("nextSession")}
      </h2>

      {!reservation ? (
        <p className="mt-2 text-sm text-brand-tab">{tn("none")}</p>
      ) : (
        <>
          {/* Gris més fosc que el `muted`: sobre el lila clar, el muted no
              arriba a 4,5:1. */}
          <p className="mt-2 text-lg font-bold text-brand-tab first-letter:uppercase">
            {formatRelativeDay(reservation.scheduledAt, locale)}
          </p>
          <p className="text-4xl leading-none font-bold text-brand-dark sm:text-5xl">
            {formatTime(reservation.scheduledAt, locale)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-bold text-brand-dark">{tl(reservation.serviceType)}</span>
            <span className="flex items-center gap-2">
              <Avatar
                name={reservation.trainerName ?? ""}
                url={avatars.get(reservation.trainerAvatarPath ?? "") ?? null}
                size={24}
                color={colorOfPro(palette, reservation.trainerId)}
              />
              <span className="text-sm text-brand-tab">
                {t("withTrainer", { name: firstName(reservation.trainerName) })}
              </span>
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <ClientAddToCalendarButton
              serviceType={reservation.serviceType}
              otherPartyName={reservation.trainerName}
              scheduledAt={reservation.scheduledAt}
            />
            <DirectionsLink />
            <CancelReservationButton
              id={reservation.id}
              scheduledAt={reservation.scheduledAt}
              minCancellationHours={minCancellationHours}
              className="sm:ml-auto"
            />
          </div>
        </>
      )}
    </section>
  );
}

/** «Reservar una sessió»: l'acció principal, un botó gran i sol. */
export async function BookCta() {
  const t = await getTranslations("home.next");
  return (
    <Link
      href="/client/reservas"
      className={`flex items-center justify-center gap-2 rounded-2xl bg-brand-purple px-5 py-4 text-base font-bold text-white hover:bg-brand-purple-dark active:bg-brand-purple-dark ${TAP}`}
    >
      <Icon name="calendarPlus" size={21} />
      {t("book")}
    </Link>
  );
}

// ─────────────────────────── Bons ───────────────────────────

/** Un bo pendent de pagament no és cap error: es distingeix, no s'alarma. */
const BONO_TONE: Partial<Record<BonoStatus, "success" | "attention">> = {
  pending_payment: "attention",
};

/**
 * Pot sortir-hi «Renovar»: el bo és d'un paquet de la botiga (no d'un regal,
 * d'una subscripció ni fet a mà) i en queden poques (el llindar dels bons baixos). Porta a
 * comprar el mateix paquet (`/client/bonos?paquet=…`), amb el preu, el
 * pagament i la confirmació de sempre.
 */
export function canRenew(b: ClientBono, lowThreshold: number): boolean {
  return !!b.serviceId && !b.subscriptionId && (b.status === "completed" || b.remainingSessions <= lowThreshold);
}

/**
 * Les sessions que li queden a cada bo, en gran, i «Renovar» quan s'acaba.
 *
 * Arriben ja triats per la pàgina: només els que tenen sessions i, com a
 * molt, tres. La resta, a «Veure tots».
 */
export async function BonoBalance({
  bonos,
  lowThreshold,
}: {
  bonos: ClientBono[];
  lowThreshold: number;
}) {
  const [t, tl, ts, locale] = await Promise.all([
    getTranslations("home.bonos"),
    getTranslations("labels.service"),
    getTranslations("labels.bonoStatus"),
    getLocale() as Promise<Locale>,
  ]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          {t("titleLeft")}
        </h2>
        <Link
          href="/client/bonos/meus"
          className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`}
        >
          {t("seeAllShort")}
        </Link>
      </div>

      {bonos.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
          {t("empty")}{" "}
          <Link
            href="/client/bonos"
            className="font-bold text-brand-purple hover:text-brand-purple-dark hover:underline"
          >
            {t("emptyCta")}
          </Link>{" "}
          {t("emptyTail")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bonos.map((b) => {
            const used = b.totalSessions - b.remainingSessions;
            const pct = b.totalSessions > 0 ? (used / b.totalSessions) * 100 : 0;
            const renew = canRenew(b, lowThreshold);
            return (
              <li
                key={b.id}
                className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconBox name="ticket" />
                    <p className="min-w-0 truncate font-bold text-brand-dark">{tl(b.serviceType)}</p>
                  </div>
                  {BONO_TONE[b.status] && (
                    <Badge tone={BONO_TONE[b.status]!} icon="pending">
                      {ts(b.status)}
                    </Badge>
                  )}
                </div>

                {/* El que li queda, en gran: és el que es ve a mirar. */}
                <p className="leading-none">
                  <span className="text-3xl font-bold text-brand-dark">
                    {t("left", { left: b.remainingSessions })}
                  </span>{" "}
                  <span className="text-sm text-brand-muted">{t("ofTotal", { total: b.totalSessions })}</span>
                </p>

                {/* Consumit, no restant: la barra creix a mesura que es fa
                    servir el bo, que és com s'entén una barra de progrés. */}
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-brand-bg"
                  role="img"
                  aria-label={t("sessionsUsed", { used, total: b.totalSessions })}
                >
                  <div className="h-full rounded-full bg-brand-purple" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs text-brand-muted">
                    <Icon name="calendar" size={13} />
                    {b.expiresAt ? t("expiresOn", { date: formatDate(b.expiresAt, locale) }) : t("noExpiry")}
                  </p>
                  {renew && (
                    <Link
                      href={`/client/bonos?paquet=${encodeURIComponent(b.serviceId!)}`}
                      className={`ml-auto inline-flex min-h-10 items-center rounded-lg border border-brand-purple px-3 text-sm font-bold text-brand-purple hover:bg-brand-purple/10 ${TAP}`}
                    >
                      {t("renew")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ───────────────────── Properes reserves ─────────────────────

/** Nom de pila: a la seva agenda ja sap de qui parla. */
const firstName = (name: string | null) => (name ?? "").split(" ")[0] || "—";

export async function UpcomingReservations({
  reservations,
  avatars,
  palette,
  minCancellationHours,
  title,
}: {
  reservations: ClientReservation[];
  /** Per defecte «Properes reserves»; sota la pròxima sessió, «Després». */
  title?: string;
  avatars: Map<string, string>;
  palette: ColorPalette;
  minCancellationHours: number;
}) {
  const [tu, th, tl, locale] = await Promise.all([
    getTranslations("home.upcoming"),
    getTranslations("home"),
    getTranslations("labels.service"),
    getLocale() as Promise<Locale>,
  ]);

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-5 py-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          {title ?? tu("title")}
        </h2>
        <Link
          href="/client/reservas"
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline"
        >
          {tu("seeAll")}
        </Link>
      </div>

      {reservations.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">
          {tu("none")}{" "}
          <Link
            href="/client/reservas"
            className="font-bold text-brand-purple hover:text-brand-purple-dark hover:underline"
          >
            {tu("bookOne")}
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {reservations.map((r) => {
            // El número del dia, en hora del CENTRE: `getDate()` dona el del
            // servidor (UTC), i una sessió de mitjanit sortia el dia d'abans.
            const dayNum = Number(centerDateStr(new Date(r.scheduledAt)).slice(8));
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                {/* Dia i mes en gran: és el que es busca amb la mirada. */}
                <div className="flex w-11 shrink-0 flex-col items-center leading-none">
                  <span className="text-xl font-bold text-brand-dark">
                    {dayNum}
                  </span>
                  <span className="text-[10px] font-bold tracking-wide text-brand-muted uppercase">
                    {formatMonthShort(r.scheduledAt, locale)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-brand-dark">
                    {tl(r.serviceType)}
                  </p>
                  <p className="truncate text-xs text-brand-muted">
                    {formatRelativeDay(r.scheduledAt, locale)} ·{" "}
                    {formatTime(r.scheduledAt, locale)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Avatar
                    name={r.trainerName ?? ""}
                    url={avatars.get(r.trainerAvatarPath ?? "") ?? null}
                    size={28}
                    color={colorOfPro(palette, r.trainerId)}
                  />
                  <span className="hidden text-xs text-brand-muted sm:inline">
                    {th("withTrainer", { name: firstName(r.trainerName) })}
                  </span>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <ClientAddToCalendarButton
                    serviceType={r.serviceType}
                    otherPartyName={r.trainerName}
                    scheduledAt={r.scheduledAt}
                  />
                  <CancelReservationButton
                    id={r.id}
                    scheduledAt={r.scheduledAt}
                    minCancellationHours={minCancellationHours}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
