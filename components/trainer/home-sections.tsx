import { TAP } from "@/lib/utils";
import Link from "next/link";
import { Icon, IconBox, type IconName } from "@/components/ui/home-icon";
import { AttentionPanel, AttentionRow } from "@/components/ui/attention";
import { pct1 } from "@/components/ui/kpi";
import { formatDate } from "@/lib/labels";
import {
  countdownLabel,
  type TrialAttentionItem,
} from "@/lib/data/trial-attention";
import type { TrainerDashboard } from "@/lib/data/dashboard";
import type { ClientListItem } from "@/lib/data/clients";

/**
 * Peces de l'inici del professional.
 *
 * Mateix llenguatge que l'admin i el client: mateixes icones, mateixes
 * targetes, mateix espaiat. Els tres taulers de l'app es veien com si fossin
 * de productes diferents; ara només canvia el que hi ha a dins.
 */

// ─────────────────────────── Capçalera ───────────────────────────

export function Header({
  name,
  today,
  clientCount,
}: {
  name: string;
  today: string;
  clientCount: number;
}) {
  return (
    <section>
      <p className="text-sm text-brand-muted">{today}</p>
      <h1 className="mt-0.5 text-2xl text-brand-dark">Hola, {name}! 👋</h1>
      <p className="mt-1 text-sm text-brand-muted">
        {clientCount === 1
          ? "1 client assignat"
          : `${clientCount} clients assignats`}
      </p>
    </section>
  );
}

// ─────────────────────────── Mètriques ───────────────────────────

/**
 * Les quatre que són seves. Res d'ingressos ni de pendents de cobrament:
 * els diners del centre no són cosa del professional.
 *
 * Les proves pendents ja no hi són: han passat a "Atenció immediata", que és
 * on demanen una resposta i no només un número.
 */
export function KpiRow({ d }: { d: TrainerDashboard }) {
  const cards: {
    icon: IconName;
    label: string;
    value: string;
    hint: string;
    href: string;
  }[] = [
    {
      icon: "calendar",
      label: "Sessions",
      value: String(d.sessions.today),
      hint: `avui · ${d.sessions.week} aquesta setmana`,
      href: "/trainer/reservas",
    },
    {
      icon: "user",
      label: "Els teus clients",
      value: String(d.clients),
      hint: d.clients === 1 ? "client assignat" : "clients assignats a tu",
      href: "/trainer/clients",
    },
    {
      icon: "ticket",
      label: "Bons a punt d'esgotar-se",
      value: String(d.lowBonos.length),
      hint:
        d.lowBonos.length === 0
          ? "Cap bo dels teus per sota del llindar"
          : d.lowBonos.length === 1
            ? "1 client a qui oferir renovació"
            : `${d.lowBonos.length} clients a qui oferir renovació`,
      href: "/trainer/bonos",
    },
    {
      icon: "chart",
      label: "Ocupació setmanal",
      value: d.occupancy.slots > 0 ? `${pct1(d.occupancy.pct)}%` : "—",
      hint:
        d.occupancy.slots > 0
          ? `${d.occupancy.booked} de ${d.occupancy.slots} franges teves`
          : "Sense disponibilitat definida",
      href: "/trainer/disponibilitat",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => {
        const warn = c.label.startsWith("Bons") && d.lowBonos.length > 0;
        return (
          <Link key={c.label} href={c.href} className="block h-full">
            {/*
              Al mòbil la icona va a sobre i no al costat, com a l'admin. Aquí
              les xifres són curtes —un compte de sessions o un percentatge—,
              però la targeta ha de ser la mateixa peça a les dues pantalles:
              si divergeixen, el dia que hi entri una xifra llarga es tornarà a
              sortir de la caixa i ningú se'n recordarà.
            */}
            <div
              className={`flex h-full flex-col items-start gap-2 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:gap-3 ${
                warn
                  ? "border-brand-orange/40 bg-brand-orange/5 hover:border-brand-orange"
                  : "border-brand-border bg-white hover:border-brand-purple"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  warn
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
          </Link>
        );
      })}
    </section>
  );
}

// ─────────────────── Atenció immediata ───────────────────

/**
 * Les seves sol·licituds de prova pendents.
 *
 * L'admin en té tres menes; el professional només aquesta, perquè és l'única
 * que li demana una resposta a ell. Si no en té cap, la secció no es pinta.
 */
export function Attention({ trials }: { trials: TrialAttentionItem[] }) {
  if (trials.length === 0) return null;

  return (
    <AttentionPanel>
      <AttentionRow
        title={
          trials.length === 1
            ? "1 sol·licitud de prova pendent"
            : `${trials.length} sol·licituds de prova pendents`
        }
        detail={
          <>
            {/* Mentre no es respon, la franja segueix bloquejada: el compte
                enrere és el que la fa urgent i no només pendent. */}
            {trials[0].name} · {formatDate(trials[0].scheduledAt)}
            {" · "}
            {countdownLabel(trials[0].hoursLeft)}
            {trials.length > 1 && ` · i ${trials.length - 1} més`}
          </>
        }
        href="/trainer/reservas"
        cta="Revisar"
      />
    </AttentionPanel>
  );
}

// ─────────────────────── Accions ràpides ───────────────────────

export function QuickActions() {
  const actions: { icon: IconName; label: string; href: string }[] = [
    { icon: "calendarPlus", label: "Reservar sessió", href: "/trainer/reservas" },
    { icon: "user", label: "Els meus clients", href: "/trainer/clients" },
    { icon: "calendar", label: "Disponibilitat", href: "/trainer/disponibilitat" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`flex items-center gap-3 rounded-2xl border border-brand-border bg-white px-4 py-4 text-base font-bold text-brand-dark hover:border-brand-purple hover:bg-brand-purple/5 active:bg-brand-purple/10 ${TAP}`}
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

// ─────────────────────── Els meus clients ───────────────────────

/** La llista de sempre, amb la caixa de la resta de la pantalla. */
export function MyClients({ clients }: { clients: ClientListItem[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-5 py-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          Els meus clients
        </h2>
        <Link
          href="/trainer/clients"
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
        >
          Veure tots
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">
          Encara no tens clients assignats.
        </p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/trainer/clients/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-brand-bg/50 sm:px-5"
              >
                <IconBox name="user" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-brand-dark">
                  {c.fullName}
                </span>
                <span className="shrink-0 text-xs text-brand-muted">
                  {c.remainingSessions === 1
                    ? "1 sessió restant"
                    : `${c.remainingSessions} sessions restants`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
