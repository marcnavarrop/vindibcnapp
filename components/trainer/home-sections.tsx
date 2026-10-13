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
import { formatDate, formatRelativeDay, formatTime, SERVICE_LABELS, SESSION_DURATION_MINUTES } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { MarkDone } from "@/components/cal-fer-tray";
import { completeTrainerReservationAction } from "@/app/(trainer)/trainer/reservas/actions";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { InboxReservation } from "@/lib/data/trainer-inbox";
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
  day,
}: {
  name: string;
  today: string;
  /** Les seves sessions d'avui (per dir quantes i quina és la pròxima). */
  day: ReservationListItem[];
}) {
  // Abans deia «56 clients assignats», que ja era a la xifra de sota. El que
  // es vol saber en obrir és com és el dia.
  const next = day.find((r) => new Date(r.scheduledAt).getTime() > Date.now() && r.status === "booked");
  const n = day.length;
  return (
    <section>
      <p className="text-sm text-brand-muted">{today}</p>
      <h1 className="mt-0.5 text-2xl text-brand-dark">Hola, {name}! 👋</h1>
      {/* Sense sessions, ja ho diu «El teu dia» just a sota. */}
      {n > 0 && (
        <p className="mt-1 text-sm text-brand-muted">
          {`Avui tens ${n === 1 ? "1 sessió" : `${n} sessions`}`}
          {next ? ` · la pròxima a les ${formatTime(next.scheduledAt)}` : " · ja no en queda cap més"}
        </p>
      )}
    </section>
  );
}

// ─────────────────────────── El teu dia ───────────────────────────

/** En quin punt és una sessió d'avui (mateix criteri que l'Inici de l'admin). */
function dayState(r: ReservationListItem): "done" | "unmarked" | "now" | "upcoming" {
  if (r.status === "completed") return "done";
  const start = new Date(r.scheduledAt).getTime();
  const end = start + SESSION_DURATION_MINUTES * 60_000;
  if (end <= Date.now()) return "unmarked";
  if (start <= Date.now()) return "now";
  return "upcoming";
}

/**
 * «El teu dia»: les seves sessions d'avui amb l'hora, el client i en quin punt
 * són, i «Marcar feta» a les que ja han acabat. És el primer que es mira en
 * obrir l'app; abans calia baixar per sota de quatre xifres, tres dreceres i
 * els avisos, i la llista no deia l'hora.
 */
export function TrainerDay({ day, failed }: { day: ReservationListItem[]; failed?: boolean }) {
  const nextId = day.find((r) => dayState(r) === "upcoming")?.id;
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-5 py-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">El teu dia</h2>
        <Link
          href="/trainer/reservas"
          className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`}
        >
          Agenda
        </Link>
      </div>
      {failed ? (
        <p role="alert" className="px-5 py-6 text-sm text-error">No s&apos;han pogut carregar les sessions d&apos;avui.</p>
      ) : day.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">Avui no tens cap sessió.</p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {day.map((r) => {
            const st = dayState(r);
            return (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 ${st === "done" ? "opacity-70" : ""} ${r.id === nextId ? "border-l-4 border-l-brand-orange" : ""}`}
              >
                <span className="w-12 shrink-0 text-lg font-bold text-brand-dark tabular-nums">{formatTime(r.scheduledAt)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-brand-dark">{r.clientName}</p>
                  <p className="truncate text-xs text-brand-muted">{SERVICE_LABELS[r.serviceType]}</p>
                </div>
                {st === "done" && <Badge tone="success">Feta</Badge>}
                {st === "now" && <Badge tone="info" icon={null}>Ara</Badge>}
                {r.id === nextId && <Badge tone="info" icon={null}>Pròxima</Badge>}
                {st === "unmarked" && <MarkDone id={r.id} action={completeTrainerReservationAction} />}
              </li>
            );
          })}
        </ul>
      )}
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
      value: String(d.sessions.week),
      hint: "aquesta setmana",
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

  // Tres xifres de la setmana. Els bons per renovar ja tenen la seva targeta a
  // sota amb els noms; aquí n'era un duplicat.
  return (
    <section aria-labelledby="kpi-setmana" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <h2 id="kpi-setmana" className="col-span-full text-xs font-bold tracking-widest text-brand-muted uppercase">
        Aquesta setmana
      </h2>
      <KpiFailedNotice count={cards.filter((c) => failed.has(c.part)).length} />
      {cards.map((c) => {
        const warn =
          !failed.has(c.part) && c.label.startsWith("Bons") && d.lowBonos.length > 0;
        return (
          // Tres targetes en dues columnes: l'última ocupa la fila sencera
          // al mòbil, en comptes de quedar-se sola a mitja amplada.
          <Link key={c.label} href={c.href} className={`block h-full ${TAP_SURFACE} last:col-span-2 lg:last:col-span-1`}>
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
/** Quantes sessions sense marcar d'altres dies s'ensenyen a «Per fer». */
const TO_MARK_SHOWN = 5;

/**
 * «Per fer»: el que demana feina, cada cosa amb el botó que la resol.
 *
 * - Les proves per respondre (mentre no es responen, la franja és bloquejada).
 * - Les seves sessions d'ALTRES dies que encara són reservades, amb «Marcar
 *   feta» aquí mateix (`complete_reservation`, la mateixa acció que a
 *   Reserves): una sessió sense marcar no es paga a les liquidacions. Les
 *   d'avui ja surten a «El teu dia».
 * - L'historial clínic d'un client seu amb novetats (0110).
 *
 * Si no hi ha res, no es pinta.
 */
export function ToDo({
  trials,
  toMark,
  clinical = [],
}: {
  trials: TrialAttentionItem[];
  toMark: InboxReservation[];
  /** Clients seus amb novetats a l'historial clínic que encara no ha obert (0110). */
  clinical?: { id: string; name: string }[];
}) {
  if (trials.length === 0 && toMark.length === 0 && clinical.length === 0) return null;
  const count = trials.length + toMark.length + clinical.length;

  return (
    <AttentionPanel title="Per fer" count={count}>
      {trials.length > 0 && (
        <AttentionRow
          title={trials.length === 1 ? "1 prova per respondre" : `${trials.length} proves per respondre`}
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
          cta="Respondre"
        />
      )}
      {toMark.slice(0, TO_MARK_SHOWN).map((r) => (
        <AttentionRow
          key={r.id}
          title={`Sense marcar · ${r.clientName}`}
          detail={`${formatRelativeDay(r.scheduledAt)} · ${formatTime(r.scheduledAt)} · ${SERVICE_LABELS[r.serviceType]}`}
          href="/trainer/reservas"
          cta="Marcar"
          action={<MarkDone id={r.id} action={completeTrainerReservationAction} />}
        />
      ))}
      {toMark.length > TO_MARK_SHOWN && (
        <AttentionRow
          title={`I ${toMark.length - TO_MARK_SHOWN} sessions més sense marcar`}
          detail="Una sessió que no es marca com a feta no es paga a les liquidacions."
          href="/trainer/reservas"
          cta="Veure-les"
        />
      )}
      {/* Algú altre (el fisio o l'admin) hi ha escrit des que el va mirar.
          Porta al primer; la resta es veuen al nom i a la seva fitxa. */}
      {clinical.length > 0 && (
        <AttentionRow
          title={
            clinical.length === 1
              ? "Historial clínic nou: 1 client"
              : `Historial clínic nou: ${clinical.length} clients`
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
