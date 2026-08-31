import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { Icon, IconBox, type IconName } from "@/components/ui/home-icon";
import { Badge } from "@/components/ui/badge";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import { CancelReservationButton } from "@/components/forms/cancel-reservation-button";
import { colorOfPro, type ColorPalette } from "@/lib/colors";
import {
  formatDate,
  formatTime,
  formatMonthShort,
} from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { ClientBono, ClientReservation } from "@/lib/data/clients";
import type { ClientKpis } from "@/lib/data/client-dashboard";
import type { BonoStatus } from "@/types/database";

/**
 * Peces de l'inici del client.
 *
 * Totes són de presentació i només les fa servir aquella pàgina; viuen juntes
 * en un fitxer perquè es llegeixin d'un cop, i fora de la pàgina perquè la
 * pàgina es quedi amb el que fa de debò: demanar les dades i ordenar-les.
 */

// ─────────────────────────── KPIs ───────────────────────────

export async function KpiRow({ kpis }: { kpis: ClientKpis }) {
  const t = await getTranslations("home.kpi");
  const cards: { icon: IconName; label: string; value: string; hint: string }[] =
    [
      {
        icon: "calendar",
        label: t("remainingSessions"),
        value: String(kpis.remainingSessions),
        hint: t("scheduled", { total: kpis.totalSessions }),
      },
      {
        icon: "ticket",
        label: t("activeBonos"),
        value: String(kpis.activeBonos),
        hint: kpis.activeBonos === 1 ? t("bonoInProgress") : t("bonosInProgress"),
      },
      {
        icon: "calendarPlus",
        label: t("upcoming"),
        value: String(kpis.upcomingWeek),
        hint: t("nextSevenDays"),
      },
      {
        icon: "chart",
        label: t("attendance"),
        value: kpis.attendancePct === null ? "—" : `${kpis.attendancePct}%`,
        hint:
          kpis.attendancePct === null
            ? t("noClosedSessions")
            : `${kpis.attendanceDone} de ${kpis.attendanceTotal} aquest mes`,
      },
    ];

  return (
    <section className="grid grid-cols-2 gap-3 rounded-2xl border border-brand-border bg-white p-4 sm:gap-4 sm:p-5 lg:grid-cols-4">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className={
            // Separadors només entre columnes de la mateixa fila.
            i > 0
              ? "flex items-center gap-3 lg:border-l lg:border-brand-border lg:pl-4"
              : "flex items-center gap-3"
          }
        >
          <IconBox name={c.icon} />
          {/* Sense `truncate`: en mòbil, amb dues columnes de 375 px, tallava
              les etiquetes ("Sessions resta…"). Millor que facin dues línies. */}
          <div className="min-w-0">
            <p className="text-xs leading-tight text-balance text-brand-muted">
              {c.label}
            </p>
            <p className="text-2xl leading-tight font-bold text-brand-dark">
              {c.value}
            </p>
            <p className="text-xs leading-tight text-balance text-brand-muted">
              {c.hint}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

// ─────────────────────── Accions ràpides ───────────────────────

/**
 * Les tres coses que un client ve a fer.
 *
 * Eren cinc i amb un títol de secció a sobre. "Els meus pagaments" i
 * "Actualitzar dades" no són el que algú obre l'app per fer —es consulten un
 * cop cada molt—, i tenir-les aquí feia els cinc botons petits i iguals entre
 * ells. Segueixen a un clic des de Bons i des de Configuració.
 *
 * Sense capçalera: uns botons grossos i amb icona ja diuen què són, i el títol
 * només afegia una línia de text entre el resum de dalt i l'acció.
 */
export async function QuickActions() {
  const t = await getTranslations("home.actions");
  const actions: { icon: IconName; label: string; href: string }[] = [
    { icon: "calendarPlus", label: t("book"), href: "/client/reservas" },
    { icon: "ticket", label: t("buyBono"), href: "/client/bonos" },
    { icon: "dumbbell", label: t("myWorkouts"), href: "/client/exercicis" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex items-center gap-3 rounded-2xl border border-brand-border bg-white px-4 py-4 text-base font-bold text-brand-dark transition-colors hover:border-brand-purple hover:bg-brand-purple/5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
            <Icon name={a.icon} size={21} />
          </span>
          <span className="min-w-0 leading-tight text-balance">{a.label}</span>
        </Link>
      ))}
    </section>
  );
}

// ─────────────────────────── Bons ───────────────────────────

/** Un bo pendent de pagament no és cap error: es distingeix, no s'alarma. */
const BONO_TONE: Partial<Record<BonoStatus, "success" | "warn">> = {
  active: "success",
  pending_payment: "warn",
};

export async function ActiveBonos({ bonos }: { bonos: ClientBono[] }) {
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
          {t("title")}
        </h2>
        <Link
          href="/client/bonos/meus"
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
        >
          {t("seeAll")}
        </Link>
      </div>

      {bonos.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
          {t("empty")}{" "}
          <Link
            href="/client/bonos"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            {t("emptyCta")}
          </Link>{" "}
          {t("emptyTail")}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-3">
          {bonos.map((b) => {
            const used = b.totalSessions - b.remainingSessions;
            const pct =
              b.totalSessions > 0 ? (used / b.totalSessions) * 100 : 0;
            return (
              <li
                key={b.id}
                className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconBox name="ticket" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-brand-dark">
                        {tl(b.serviceType)}
                      </p>
                      <p className="text-xs text-brand-muted">
                        {b.remainingSessions} / {b.totalSessions} sessions
                      </p>
                    </div>
                  </div>
                  <Badge tone={BONO_TONE[b.status] ?? "neutral"}>
                    {ts(b.status)}
                  </Badge>
                </div>

                {/* Consumit, no restant: la barra creix a mesura que es fa
                    servir el bo, que és com s'entén una barra de progrés. */}
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-brand-bg"
                  role="img"
                  aria-label={`${used} de ${b.totalSessions} sessions consumides`}
                >
                  <div
                    className="h-full rounded-full bg-brand-purple"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>

                <p className="flex items-center gap-1.5 text-xs text-brand-muted">
                  <Icon name="calendar" size={13} />
                  {b.expiresAt
                    ? t("expiresOn", { date: formatDate(b.expiresAt, locale) })
                    : t("noExpiry")}
                </p>
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
}: {
  reservations: ClientReservation[];
  avatars: Map<string, string>;
  palette: ColorPalette;
  minCancellationHours: number;
}) {
  const [tu, tl, locale] = await Promise.all([
    getTranslations("home.upcoming"),
    getTranslations("labels.service"),
    getLocale() as Promise<Locale>,
  ]);
  const minMs = minCancellationHours * 60 * 60 * 1000;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-5 py-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          {tu("title")}
        </h2>
        <Link
          href="/client/reservas"
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
        >
          {tu("seeAll")}
        </Link>
      </div>

      {reservations.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">
          {tu("none")}{" "}
          <Link
            href="/client/reservas"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            {tu("bookOne")}
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {reservations.map((r) => {
            const d = new Date(r.scheduledAt);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                {/* Dia i mes en gran: és el que es busca amb la mirada. */}
                <div className="flex w-11 shrink-0 flex-col items-center leading-none">
                  <span className="text-xl font-bold text-brand-dark">
                    {d.getDate()}
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
                    {formatDate(r.scheduledAt, locale)} ·{" "}
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
                    Amb {firstName(r.trainerName)}
                  </span>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <AddToCalendarButton
                    serviceType={r.serviceType}
                    otherPartyName={r.trainerName}
                    scheduledAt={r.scheduledAt}
                  />
                  <CancelReservationButton
                    id={r.id}
                    scheduledAt={r.scheduledAt}
                    minCancellationHours={minCancellationHours}
                    minMs={minMs}
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

// ─────────────────────── Pròxima sessió ───────────────────────

export async function NextSessionCard({
  reservation,
  avatars,
  palette,
}: {
  reservation: ClientReservation;
  avatars: Map<string, string>;
  palette: ColorPalette;
}) {
  const [t, tl, locale] = await Promise.all([
    getTranslations("home"),
    getTranslations("labels.service"),
    getLocale() as Promise<Locale>,
  ]);

  return (
    <section className="rounded-2xl border border-brand-purple/20 bg-brand-purple/5 p-5">
      <h2 className="mb-3 text-xs font-bold tracking-widest text-brand-purple uppercase">
        {t("nextSession")}
      </h2>

      <div className="flex items-start gap-3">
        <IconBox name="calendarPlus" />
        <div className="min-w-0">
          <p className="font-bold text-brand-dark">
            {tl(reservation.serviceType)}
          </p>
          <p className="text-xs text-brand-muted">
            {formatDate(reservation.scheduledAt, locale)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold text-brand-dark">
        {formatTime(reservation.scheduledAt, locale)}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Avatar
          name={reservation.trainerName ?? ""}
          url={avatars.get(reservation.trainerAvatarPath ?? "") ?? null}
          size={22}
          color={colorOfPro(palette, reservation.trainerId)}
        />
        <span className="text-sm text-brand-muted">
          Amb {firstName(reservation.trainerName)}
        </span>
      </div>

      <div className="mt-4">
        <AddToCalendarButton
          serviceType={reservation.serviceType}
          otherPartyName={reservation.trainerName}
          scheduledAt={reservation.scheduledAt}
          className="w-full"
        />
      </div>
    </section>
  );
}
