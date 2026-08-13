import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import { CancelReservationButton } from "@/components/forms/cancel-reservation-button";
import { colorOfPro, type ColorPalette } from "@/lib/colors";
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  formatDate,
  formatTime,
  formatMonthShort,
} from "@/lib/labels";
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

// ─────────────────────────── Icones ───────────────────────────

const ICONS = {
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z" />
      <path d="M14 6v12" strokeDasharray="2 3" />
    </>
  ),
  calendarPlus: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4" />
    </>
  ),
  chart: (
    <>
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M3 9v6M7 6v12M17 6v12M21 9v6M7 12h10" />
    </>
  ),
  euro: (
    <>
      <path d="M17 6a6 6 0 100 12M4 10h8M4 14h8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 13h18M12 9v12" />
      <path d="M12 9S10.5 3 7.5 3a2.5 2.5 0 000 5H12zM12 9s1.5-6 4.5-6a2.5 2.5 0 010 5H12z" />
    </>
  ),
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

/** Quadrat lila amb la icona, el mateix a tota la pantalla. */
function IconBox({ name }: { name: IconName }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple">
      <Icon name={name} />
    </span>
  );
}

// ─────────────────────────── KPIs ───────────────────────────

export function KpiRow({ kpis }: { kpis: ClientKpis }) {
  const cards: { icon: IconName; label: string; value: string; hint: string }[] =
    [
      {
        icon: "calendar",
        label: "Sessions restants",
        value: String(kpis.remainingSessions),
        hint: `de ${kpis.totalSessions} programades`,
      },
      {
        icon: "ticket",
        label: "Bons actius",
        value: String(kpis.activeBonos),
        hint: kpis.activeBonos === 1 ? "bo en curs" : "bons en curs",
      },
      {
        icon: "calendarPlus",
        label: "Properes reserves",
        value: String(kpis.upcomingWeek),
        hint: "els pròxims 7 dies",
      },
      {
        icon: "chart",
        label: "Assistència",
        value: kpis.attendancePct === null ? "—" : `${kpis.attendancePct}%`,
        hint:
          kpis.attendancePct === null
            ? "sense sessions tancades"
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
export function QuickActions() {
  const actions: { icon: IconName; label: string; href: string }[] = [
    { icon: "calendarPlus", label: "Reservar sessió", href: "/client/reservas" },
    { icon: "ticket", label: "Comprar bo", href: "/client/bonos/comprar" },
    { icon: "dumbbell", label: "Els meus entrenaments", href: "/client/exercicis" },
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

export function ActiveBonos({ bonos }: { bonos: ClientBono[] }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          Bons actius
        </h2>
        <Link
          href="/client/bonos"
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
        >
          Veure tots els bons →
        </Link>
      </div>

      {bonos.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
          Encara no tens cap bo actiu.{" "}
          <Link
            href="/client/bonos/comprar"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            Compra&apos;n un
          </Link>{" "}
          per començar a reservar.
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
                        {SERVICE_LABELS[b.serviceType]}
                      </p>
                      <p className="text-xs text-brand-muted">
                        {b.remainingSessions} / {b.totalSessions} sessions
                      </p>
                    </div>
                  </div>
                  <Badge tone={BONO_TONE[b.status] ?? "neutral"}>
                    {BONO_STATUS_LABELS[b.status]}
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
                    ? `Caduca el ${formatDate(b.expiresAt)}`
                    : "Sense data de caducitat"}
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

export function UpcomingReservations({
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
  const minMs = minCancellationHours * 60 * 60 * 1000;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-5 py-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          Properes reserves
        </h2>
        <Link
          href="/client/reservas"
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
        >
          Veure totes →
        </Link>
      </div>

      {reservations.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">
          No tens cap reserva propera.{" "}
          <Link
            href="/client/reservas"
            className="font-bold text-brand-purple hover:text-brand-orange"
          >
            Reserva una sessió
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
                    {formatMonthShort(r.scheduledAt)}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-brand-dark">
                    {SERVICE_LABELS[r.serviceType]}
                  </p>
                  <p className="truncate text-xs text-brand-muted">
                    {formatDate(r.scheduledAt)} · {formatTime(r.scheduledAt)}
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

export function NextSessionCard({
  reservation,
  avatars,
  palette,
}: {
  reservation: ClientReservation;
  avatars: Map<string, string>;
  palette: ColorPalette;
}) {
  return (
    <section className="rounded-2xl border border-brand-purple/20 bg-brand-purple/5 p-5">
      <h2 className="mb-3 text-xs font-bold tracking-widest text-brand-purple uppercase">
        Pròxima sessió
      </h2>

      <div className="flex items-start gap-3">
        <IconBox name="calendarPlus" />
        <div className="min-w-0">
          <p className="font-bold text-brand-dark">
            {SERVICE_LABELS[reservation.serviceType]}
          </p>
          <p className="text-xs text-brand-muted">
            {formatDate(reservation.scheduledAt)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold text-brand-dark">
        {formatTime(reservation.scheduledAt)}
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
