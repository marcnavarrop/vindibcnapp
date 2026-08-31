import Link from "next/link";
import { Icon, IconBox, type IconName } from "@/components/ui/home-icon";
import { pct1 } from "@/components/ui/kpi";
import { SERVICE_LABELS, formatEur, formatTime } from "@/lib/labels";
import type { AdminDashboard } from "@/lib/data/dashboard";
import type { ReservationListItem } from "@/lib/data/reservations";

/**
 * Peces de l'inici de l'admin.
 *
 * Mateix llenguatge visual que l'inici del client: targetes compactes, la
 * mateixa graella d'icones i el mateix espaiat. Fins ara els dos taulers de
 * l'app es veien com si fossin de productes diferents.
 *
 * Tot en català: aquesta àrea no es tradueix.
 */

// ─────────────────────────── Capçalera ───────────────────────────

export function Header({ name, today }: { name: string; today: string }) {
  return (
    <section>
      <p className="text-sm text-brand-muted">{today}</p>
      <h1 className="mt-0.5 text-2xl text-brand-dark">Hola, {name}! 👋</h1>
      <p className="mt-1 text-sm text-brand-muted">Com va el centre avui.</p>
    </section>
  );
}

// ─────────────────────────── Mètriques ───────────────────────────

/**
 * Les sis de sempre, amb el mateix càlcul.
 *
 * Els números surten de `getAdminDashboard` sense tocar-los: aquí només canvia
 * com es pinten. Sis en una fila serien massa estretes, així que van de tres
 * en tres —dues files a l'escriptori, dues columnes al mòbil—.
 */
export function KpiRow({ d }: { d: AdminDashboard }) {
  const { revenue, pendingBonos, lowBonos, sessions, occupancy, trialConversion } = d;

  const cards: {
    icon: IconName;
    label: string;
    value: string;
    hint: React.ReactNode;
    href?: string;
    warn?: boolean;
  }[] = [
    {
      icon: "euro",
      label: "Ingressos del mes",
      value: formatEur(revenue.current),
      hint:
        revenue.changePct === null ? (
          `Sense ingressos el ${revenue.previousMonthLabel}`
        ) : (
          <span
            className={revenue.changePct >= 0 ? "text-success" : "text-error"}
          >
            {revenue.changePct >= 0 ? "↑" : "↓"}
            {pct1(Math.abs(revenue.changePct))}% vs {revenue.previousMonthLabel}
          </span>
        ),
      href: "/admin/pagos",
    },
    {
      icon: "ticket",
      label: "Pendent de cobrament",
      value: formatEur(pendingBonos.total),
      hint:
        pendingBonos.count === 1
          ? "1 bo per cobrar al centre"
          : `${pendingBonos.count} bons per cobrar al centre`,
      href: "/admin/bonos",
      // Només crida l'atenció si hi ha alguna cosa a cobrar.
      warn: pendingBonos.count > 0,
    },
    {
      icon: "ticket",
      label: "Bons a punt d'esgotar-se",
      value: String(lowBonos.length),
      hint:
        lowBonos.length === 0
          ? "Cap bo per sota del llindar"
          : lowBonos.length === 1
            ? "1 client a qui oferir renovació"
            : `${lowBonos.length} clients a qui oferir renovació`,
      href: "/admin/bonos",
      warn: lowBonos.length > 0,
    },
    {
      icon: "calendar",
      label: "Sessions",
      value: String(sessions.today),
      hint: `avui · ${sessions.week} aquesta setmana`,
      href: "/admin/reservas",
    },
    {
      icon: "chart",
      label: "Ocupació setmanal",
      value: occupancy.slots > 0 ? `${pct1(occupancy.pct)}%` : "—",
      hint:
        occupancy.slots > 0
          ? `${occupancy.booked} de ${occupancy.slots} franges`
          : "Sense franges definides",
      href: "/admin/disponibilitat",
    },
    {
      icon: "user",
      label: "Conversió de proves",
      value:
        trialConversion.pct === null ? "—" : `${pct1(trialConversion.pct)}%`,
      hint:
        trialConversion.total === 0
          ? "Encara no hi ha proves fetes"
          : `${trialConversion.converted} de ${trialConversion.total} proves`,
      href: "/admin/prova",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {cards.map((c) => {
        const body = (
          <div
            /*
             * Al mòbil la icona va a sobre i no al costat.
             *
             * Amb dues columnes de 375 px, un import com "650,00 €" en 24 px no
             * cabia al costat d'un quadrat de 40: se sortia de la targeta. Les
             * xifres de l'inici del client són d'un o dos dígits i no ho
             * patien; aquí n'hi ha d'euros i cal l'amplada sencera.
             */
            className={`flex h-full flex-col items-start gap-2 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:gap-3 ${
              c.warn
                ? "border-brand-orange/40 bg-brand-orange/5 hover:border-brand-orange"
                : "border-brand-border bg-white hover:border-brand-purple"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                c.warn
                  ? "bg-brand-orange/15 text-brand-orange"
                  : "bg-brand-purple/10 text-brand-purple"
              }`}
            >
              <Icon name={c.icon} />
            </span>
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
        );
        return c.href ? (
          <Link key={c.label} href={c.href} className="block h-full">
            {body}
          </Link>
        ) : (
          <div key={c.label}>{body}</div>
        );
      })}
    </section>
  );
}

// ─────────────────────── Accions ràpides ───────────────────────

/**
 * Les quatre coses que l'admin fa entrant, no navegant.
 *
 * No són dreceres al menú —això ja és el menú—: són el primer pas d'una
 * tasca. Donar d'alta algú, posar-li una sessió, cobrar el que està pendent i
 * mirar els vals, que és l'únic diner que entra sense passar per una fitxa de
 * client i el que més fàcil és oblidar.
 */
export function QuickActions() {
  const actions: { icon: IconName; label: string; href: string }[] = [
    { icon: "user", label: "Nou client", href: "/admin/clients/new" },
    { icon: "calendarPlus", label: "Nova reserva", href: "/admin/reservas" },
    { icon: "ticket", label: "Bons pendents", href: "/admin/bonos" },
    { icon: "gift", label: "Vals de regal", href: "/admin/vals-regal" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

// ─────────────────────── Avui al centre ───────────────────────

/** Nom de pila: la llista ja té prou columnes. */
const firstName = (name: string | null) => (name ?? "").split(" ")[0] || "—";

/**
 * Les sessions d'avui de TOT el centre, no només les d'un professional.
 *
 * L'admin no té agenda pròpia: el que necessita és saber què passa avui a la
 * casa, de qui és cada sessió i amb qui. Per això la fila porta el
 * professional, que a l'inici del client no hi fa falta.
 */
export function TodayAtCentre({
  reservations,
}: {
  reservations: ReservationListItem[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-5 py-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          Avui al centre
        </h2>
        <Link
          href="/admin/reservas"
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
        >
          Veure l&apos;agenda
        </Link>
      </div>

      {reservations.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">
          Avui no hi ha cap sessió programada.
        </p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {reservations.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
            >
              {/* L'hora en gran: en una llista d'un sol dia, és l'única cosa
                  que distingeix una fila de la següent amb la mirada. */}
              <span className="w-12 shrink-0 text-lg font-bold text-brand-dark tabular-nums">
                {formatTime(r.scheduledAt)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-brand-dark">
                  {r.clientName}
                </p>
                <p className="truncate text-xs text-brand-muted">
                  {SERVICE_LABELS[r.serviceType]}
                </p>
              </div>

              <span className="flex shrink-0 items-center gap-1.5 text-xs text-brand-muted">
                <Icon name="user" size={13} />
                {firstName(r.trainerName)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─────────────────── Ocupació per professional ───────────────────

/**
 * El detall que hi havia dins de la targeta d'ocupació.
 *
 * Surt de la mètrica i passa a secció pròpia: dins d'una targeta compacta no
 * hi cabien les barres sense trencar l'alçada de tota la fila, i és informació
 * que es mira amb calma, no d'un cop d'ull.
 */
export function OccupancyByTrainer({ d }: { d: AdminDashboard }) {
  if (d.occupancy.perTrainer.length === 0) return null;
  return (
    <section className="rounded-2xl border border-brand-border bg-white p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <IconBox name="chart" />
        <div>
          <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
            Ocupació per professional
          </h2>
          <p className="text-xs text-brand-muted">
            {d.occupancy.booked} de {d.occupancy.slots} franges aquesta setmana
          </p>
        </div>
      </div>
      <ul className="space-y-2.5">
        {d.occupancy.perTrainer.map((t) => (
          <li key={t.trainerId}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-brand-charcoal">
                {t.trainerName}
              </span>
              <span className="shrink-0 font-bold text-brand-muted">
                {pct1(t.pct)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-bg">
              <div
                className="h-full rounded-full bg-brand-purple"
                style={{ width: `${Math.min(100, t.pct)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
