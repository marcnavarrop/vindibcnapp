import { TAP, TAP_SURFACE } from "@/lib/utils";
import Link from "next/link";
import { Icon, IconBox, type IconName } from "@/components/ui/home-icon";
import { AttentionPanel, AttentionRow } from "@/components/ui/attention";
import {
  pct1,
  KpiFailedNotice,
  KPI_FAILED_VALUE,
  KPI_FAILED_HINT,
} from "@/components/ui/kpi";
import { formatDate } from "@/lib/labels";
import {
  countdownLabel,
  type TrialAttentionItem,
} from "@/lib/data/trial-attention";
import type { TrainerDashboard, DashboardPart } from "@/lib/data/dashboard";
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
    /** De quina consulta surt: si ha fallat, la targeta ho diu. */
    part: DashboardPart;
    icon: IconName;
    label: string;
    value: string;
    hint: string;
    href: string;
  }[] = [
    {
      part: "sessions",
      icon: "calendar",
      label: "Sessions",
      value: String(d.sessions.today),
      hint: `avui · ${d.sessions.week} aquesta setmana`,
      href: "/trainer/reservas",
    },
    {
      part: "clients",
      icon: "user",
      label: "Els teus clients",
      value: String(d.clients),
      hint: d.clients === 1 ? "client assignat" : "clients assignats a tu",
      href: "/trainer/clients",
    },
    {
      part: "lowBonos",
      icon: "ticket",
      label: "Bons a punt d'esgotar-se",
      value: String(d.lowBonos.length),
      hint:
        d.lowBonos.length === 0
          ? "Cap bo dels teus per sota del llindar"
          : (() => {
              // Clients, no bons: un client amb dos bons baixos compta un cop.
              const n = new Set(d.lowBonos.map((b) => b.clientId)).size;
              return n === 1 ? "1 client a qui oferir renovació" : `${n} clients a qui oferir renovació`;
            })(),
      href: "/trainer/bonos",
    },
    {
      part: "occupancy",
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

  // Una part que ha fallat no ensenya un zero que sembli cert: guionet i avís.
  const failed = new Set(d.failed);
  for (const c of cards)
    if (failed.has(c.part)) {
      c.value = KPI_FAILED_VALUE;
      c.hint = KPI_FAILED_HINT;
    }

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiFailedNotice count={cards.filter((c) => failed.has(c.part)).length} />
      {cards.map((c) => {
        const warn =
          !failed.has(c.part) && c.label.startsWith("Bons") && d.lowBonos.length > 0;
        return (
          <Link key={c.label} href={c.href} className={`block h-full ${TAP_SURFACE}`}>
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
                  ? "border-attention/25 bg-attention-bg hover:border-attention [&_.text-brand-muted]:text-brand-tab"
                  : "border-brand-border bg-white hover:border-brand-purple"
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  warn
                    ? "bg-attention/10 text-attention"
                    : "bg-brand-purple/10 text-brand-purple"
                }`}
              >
                <Icon name={c.icon} />
              </span>
              <div className="min-w-0">
                <p className="text-xs leading-tight text-balance text-brand-muted">
                  {/* L'exclamació: en blanc i negre, el fons blau no basta per veure
                      que la xifra demana feina (pas 7). */}
                  {warn && (
                    <span className="mr-1 inline-flex align-[-2px] text-attention" data-warn-mark>
                      <Icon name="alert" size={13} />
                    </span>
                  )}
                  {c.label}
                </p>
                <p className="text-2xl leading-tight font-bold text-brand-dark">
                  {c.value}
                </p>
                <p
                  className={`text-xs leading-tight text-balance ${
                    failed.has(c.part) ? "text-error" : "text-brand-muted"
                  }`}
                >
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
export function Attention({
  trials,
  clinical = [],
}: {
  trials: TrialAttentionItem[];
  /** Clients seus amb novetats a l'historial clínic que encara no ha obert (0110). */
  clinical?: { id: string; name: string }[];
}) {
  if (trials.length === 0 && clinical.length === 0) return null;

  return (
    <AttentionPanel>
      {trials.length > 0 && (
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
      )}
      {/* Algú altre (el fisio o l'admin) hi ha escrit des que el va mirar.
          Porta al primer; la resta es veuen al nom i a la seva fitxa. */}
      {clinical.length > 0 && (
        <AttentionRow
          title={
            clinical.length === 1
              ? "Historial clínic amb novetats: 1 client"
              : `Historial clínic amb novetats: ${clinical.length} clients`
          }
          detail={
            <>
              {clinical[0].name}
              {clinical.length > 1 && ` · i ${clinical.length - 1} més`}
            </>
          }
          href={`/trainer/clients/${clinical[0].id}?pestanya=historial-clinic`}
          cta="Llegir"
        />
      )}
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
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple">
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
/**
 * Els seus clients, els primers cinc i el total: la llista sencera ja és a
 * Clients. Amb 56 clients, aquesta secció feia sis pantalles d'escriptori i
 * vuit de mòbil i enterrava la comunitat.
 */
const MY_CLIENTS_SHOWN = 5;

export function MyClients({ clients }: { clients: ClientListItem[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-5 py-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          Els meus clients{clients.length > 0 ? ` · ${clients.length}` : ""}
        </h2>
        <Link
          href="/trainer/clients"
          className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`}
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
          {clients.slice(0, MY_CLIENTS_SHOWN).map((c) => (
            <li key={c.id}>
              <Link
                href={`/trainer/clients/${c.id}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-brand-bg/50 sm:px-5 ${TAP}`}
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
          {clients.length > MY_CLIENTS_SHOWN && (
            <li>
              <Link
                href="/trainer/clients"
                className={`block px-5 py-3 text-xs font-bold text-brand-purple hover:underline ${TAP}`}
              >
                I {clients.length - MY_CLIENTS_SHOWN} més · veure tots els clients →
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
