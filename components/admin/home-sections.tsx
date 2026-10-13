import { TAP, TAP_SURFACE } from "@/lib/utils";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/home-icon";
import { AttentionPanel, AttentionRow } from "@/components/ui/attention";
import { countdownLabel } from "@/lib/data/trial-attention";
import {
  pct1,
  KpiFailedNotice,
  KPI_FAILED_VALUE,
  KPI_FAILED_HINT,
} from "@/components/ui/kpi";
import {
  SERVICE_LABELS,
  SESSION_DURATION_MINUTES,
  formatDate,
  formatEur,
  formatTime,
} from "@/lib/labels";
import type { AdminDashboard, DashboardPart } from "@/lib/data/dashboard";
import { Badge } from "@/components/ui/badge";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { AdminAttention } from "@/lib/data/admin-attention";
import type { AgendaHealth, UnmarkedByTrainer } from "@/lib/data/admin-agenda-health";
import { centerDateStr } from "@/lib/center-time";
import { GROUP_CAPACITY } from "@/lib/labels";

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
    <section className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-brand-muted">{today}</p>
        <h1 className="mt-0.5 text-2xl text-brand-dark">Hola, {name}! 👋</h1>
      </div>
      {/* Les dues tasques que l'admin comença des de l'inici. Abans eren
          quatre targetes grans (~350 px al mòbil) per sobre dels avisos; la
          resta ja és al menú. */}
      <div className="flex gap-2">
        <Link
          href="/admin/reservas"
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-purple px-3 text-sm font-bold text-white hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
        >
          <Icon name="calendarPlus" size={16} /> Reserva
        </Link>
        <Link
          href="/admin/clients/new"
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand-purple bg-white px-3 text-sm font-bold text-brand-purple hover:bg-brand-purple/5 ${TAP}`}
        >
          <Icon name="user" size={16} /> Client
        </Link>
      </div>
    </section>
  );
}

/**
 * On porta «Pendent de cobrament» (i l'accés «Bons pendents»): a Bons amb el
 * filtre ja posat, perquè els pendents no quedin al final de «Tots».
 *
 * La xifra suma pendents i decaiguts, i Bons els té en dos filtres. S'obre el
 * dels pendents si n'hi ha —són la feina de cada dia, al taulell—; si només hi
 * ha decaiguts, el seu. L'altre filtre segueix al costat amb el seu comptador.
 */
export function collectableHref(c: { pending: number; unpaid: number }): string {
  if (c.pending > 0) return "/admin/bonos?estat=pending_payment";
  if (c.unpaid > 0) return "/admin/bonos?estat=unpaid";
  return "/admin/bonos";
}

// ─────────────────────────── Mètriques ───────────────────────────

/**
 * «Com va el centre»: quatre xifres (tres amb el mòdul de proves apagat).
 *
 * Els números surten de `getAdminDashboard`, sense els comptes demo. Van
 * després de «Per resoldre» i d'«Avui al centre»: primer el que demana feina,
 * després el dia i al final els números. La conversió de proves cau amb el
 * mòdul apagat: la seva targeta enllaça a `/admin/prova`, que llavors respon
 * 404 (el mateix criteri que amaga l'entrada del menú).
 */
export function KpiRow({ d }: { d: AdminDashboard }) {
  const { revenue, sessions, occupancy, trialConversion } = d;

  const cards: {
    /** De quina consulta surt: si ha fallat, la targeta ho diu. */
    part: DashboardPart;
    icon: IconName;
    label: string;
    value: string;
    hint: React.ReactNode;
    href?: string;
    warn?: boolean;
  }[] = [
    {
      part: "revenue",
      icon: "euro",
      label: "Ingressos fins avui",
      value: formatEur(revenue.current),
      hint:
        revenue.changePct === null ? (
          `Sense ingressos de l'${revenue.compareLabel}`
        ) : (
          <span
            className={revenue.changePct >= 0 ? "text-success" : "text-error"}
          >
            {revenue.changePct >= 0 ? "↑" : "↓"}
            {pct1(Math.abs(revenue.changePct))}% vs <span className="whitespace-nowrap">{revenue.compareLabel}</span>
          </span>
        ),
      href: "/admin/pagos",
    },
    {
      part: "sessions",
      icon: "calendar",
      label: "Sessions aquesta setmana",
      value: String(sessions.week),
      hint: `${sessions.today} avui`,
      href: "/admin/reservas",
    },
    {
      part: "occupancy",
      icon: "chart",
      label: "Ocupació setmanal",
      value: occupancy.slots > 0 ? `${pct1(occupancy.pct)}%` : "—",
      hint:
        occupancy.slots > 0
          ? // Per professional, els tres primers: abans era una secció a part.
            occupancy.perTrainer
              .slice(0, 3)
              .map((t) => `${firstName(t.trainerName)} ${Math.round(t.pct)}%`)
              .join(" · ")
          : "Sense franges definides",
      href: "/admin/disponibilitat",
    },
    // El mòdul de proves apagat arriba com a null i la targeta no s'afegeix.
    // El guionet segueix sent per a "encara no n'hi ha cap", que és una altra
    // cosa: aleshores la pantalla existeix i val la pena poder-hi anar.
    ...(trialConversion
      ? [
          {
            part: "trials" as DashboardPart,
            icon: "user" as IconName,
            label: "Conversió de proves",
            value:
              trialConversion.pct === null
                ? "—"
                : `${pct1(trialConversion.pct)}%`,
            hint:
              trialConversion.total === 0
                ? "Encara no hi ha proves fetes"
                : `${trialConversion.converted} de ${trialConversion.total} proves`,
            href: "/admin/prova",
          },
        ]
      : []),
  ];

  // Una part que ha fallat no ensenya un zero que sembli cert: guionet i avís.
  const failed = new Set(d.failed);
  for (const c of cards)
    if (failed.has(c.part)) {
      c.value = KPI_FAILED_VALUE;
      c.hint = <span className="text-error">{KPI_FAILED_HINT}</span>;
      c.warn = false;
    }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
        Com va el centre
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiFailedNotice count={cards.filter((c) => failed.has(c.part)).length} />
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
                ? "border-attention/25 bg-attention-bg hover:border-attention [&_.text-brand-muted]:text-brand-tab"
                : "border-brand-border bg-white hover:border-brand-purple"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                c.warn
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
                {c.warn && (
                  <span className="mr-1 inline-flex align-[-2px] text-attention" data-warn-mark>
                    <Icon name="alert" size={13} />
                  </span>
                )}
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
          <Link key={c.label} href={c.href} className={`block h-full ${TAP_SURFACE}`}>
            {body}
          </Link>
        ) : (
          <div key={c.label}>{body}</div>
        );
      })}
      </div>
      {/* Els números són del centre de debò: els comptes demo no hi compten. */}
      <p className="text-xs text-brand-muted">Sense els comptes demo.</p>
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
/**
 * En quin punt és una sessió d'avui: feta, per marcar (ja ha acabat i segueix
 * reservada), ara mateix o per fer. La llista porta TOT el dia —també les ja
 * fetes— perquè digui el mateix que la xifra «Sessions avui» de dalt, que les
 * compta totes; abans les fetes desapareixien de la llista.
 */
function dayState(r: ReservationListItem): "done" | "unmarked" | "now" | "upcoming" {
  if (r.status === "completed") return "done";
  const start = new Date(r.scheduledAt).getTime();
  const end = start + SESSION_DURATION_MINUTES * 60_000;
  const now = Date.now();
  if (end <= now) return "unmarked";
  if (start <= now) return "now";
  return "upcoming";
}

export function TodayAtCentre({
  reservations,
  failed,
}: {
  reservations: ReservationListItem[];
  /** La consulta ha fallat: es diu, en comptes de "avui no hi ha res". */
  failed?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-5 py-3">
        <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
          Avui al centre
        </h2>
        <Link
          href="/admin/reservas"
          className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`}
        >
          Veure l&apos;agenda
        </Link>
      </div>

      {failed ? (
        <p role="alert" className="px-5 py-6 text-sm text-error">
          No s&apos;han pogut carregar les sessions d&apos;avui.
        </p>
      ) : reservations.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">
          Avui no hi ha cap sessió programada.
        </p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {reservations.map((r) => {
            const state = dayState(r);
            return (
            <li
              key={r.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 ${state === "done" ? "opacity-70" : ""}`}
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
                <p className="flex items-center gap-1.5 truncate text-xs text-brand-muted">
                  {SERVICE_LABELS[r.serviceType]}
                  {r.isComplimentary && <Badge tone="neutral" icon="gift">Cortesia</Badge>}
                </p>
              </div>

              <span className="flex shrink-0 items-center gap-1.5 text-xs text-brand-muted">
                <Icon name="user" size={13} />
                {firstName(r.trainerName)}
              </span>
              {state === "done" && <Badge tone="success">Feta</Badge>}
              {state === "unmarked" && <Badge tone="attention">Per marcar</Badge>}
              {state === "now" && <Badge tone="info" icon={null}>Ara</Badge>}
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}


// ─────────────────── Atenció immediata ───────────────────

/**
 * El que espera resposta avui.
 *
 * Si no hi ha res, la secció NO es pinta. Un plafó d'"atenció immediata" que
 * gairebé sempre ensenya tres zeros deixa de mirar-se, i llavors el dia que
 * hi hagi alguna cosa tampoc es veurà.
 */
/**
 * «Per resoldre»: el que demana feina avui, primer, cada cosa amb el botó que
 * la resol.
 *
 * Abans eren dues peces separades i per sota dels números: «Atenció immediata»
 * (proves, vals, referits, clients sense entrenador) i, més avall, tres
 * targetes d'estat de l'agenda (sense marcar, fora d'horari, grups amb cua).
 * Al mòbil, la primera començava a més d'una pantalla. Ara és una sola llista,
 * a dalt. Si no hi ha res, no es pinta (vegeu `AttentionPanel`).
 *
 * Tot sense el món demo: ho filtren les dades (`getDemoWorld`).
 */
export function ToResolve({
  a,
  h,
  pending,
}: {
  a: AdminAttention;
  h: AgendaHealth;
  pending: AdminDashboard["pendingBonos"];
}) {
  const rows: React.ReactNode[] = [];
  let count = 0;

  if (a.trials.length > 0) {
    count += a.trials.length;
    rows.push(
      <AttentionRow
        key="trials"
        title={a.trials.length === 1 ? "1 prova per respondre" : `${a.trials.length} proves per respondre`}
        detail={
          <>
            {a.trials[0].name} · {formatDate(a.trials[0].scheduledAt)} · {countdownLabel(a.trials[0].hoursLeft)}
            {a.trials.length > 1 && ` · i ${a.trials.length - 1} més`}
          </>
        }
        href="/admin/prova"
        cta="Respondre"
      />,
    );
  }

  if (h.unmarked.ok && h.unmarked.data.total > 0) {
    const u = h.unmarked.data;
    count += u.total;
    // Cada professional, a l'últim dia que té per marcar: un toc i és allà.
    const first = u.trainers[0];
    rows.push(
      <AttentionRow
        key="unmarked"
        title={`${u.total}${u.truncated ? "+" : ""} sessions sense marcar`}
        detail={
          <>
            {u.trainers.map((t, i) => (
              <span key={t.id ?? i}>
                {i > 0 && " · "}
                <Link href={unmarkedHref(t)} className="underline hover:text-brand-dark">
                  {firstName(t.name)} {t.sessions.length}
                </Link>
              </span>
            ))}
            {" · no es paguen fins que es marquin"}
          </>
        }
        href={unmarkedHref(first)}
        cta="Marcar"
      />,
    );
  } else if (!h.unmarked.ok) {
    rows.push(<AttentionRow key="unmarked-ko" title="No s'han pogut carregar les sessions sense marcar" detail="Mira-ho a l'agenda." href="/admin/reservas" cta="Agenda" />);
  }

  if (pending.count > 0) {
    count += pending.count;
    rows.push(
      <AttentionRow
        key="collect"
        title={`${pending.count === 1 ? "1 bo" : `${pending.count} bons`} per cobrar · ${formatEur(pending.total)}`}
        detail={pending.unpaid > 0 ? `${pending.pending} pendents de pagament i ${pending.unpaid} decaiguts` : "Pendents de pagament"}
        href={collectableHref(pending)}
        cta="Cobrar"
      />,
    );
  }

  if (a.vouchers.length > 0) {
    count += a.vouchers.length;
    rows.push(
      <AttentionRow
        key="vouchers"
        title={a.vouchers.length === 1 ? "1 val de regal per cobrar" : `${a.vouchers.length} vals de regal per cobrar`}
        detail={
          <>
            {a.vouchers[0].code} · {a.vouchers[0].buyerName} · {formatEur(a.vouchers[0].price)}
            {a.vouchers.length > 1 && ` · i ${a.vouchers.length - 1} més`} · no es pot bescanviar fins que es cobri
          </>
        }
        href="/admin/vals-regal"
        cta="Cobrar"
      />,
    );
  }

  if (a.trainingWithoutTrainer > 0) {
    count += a.trainingWithoutTrainer;
    rows.push(
      <AttentionRow
        key="no-trainer"
        title={a.trainingWithoutTrainer === 1 ? "1 client sense entrenador" : `${a.trainingWithoutTrainer} clients sense entrenador`}
        detail="Tenen bo d'individual o de parelles i no el poden reservar fins que se'ls assigni un entrenador."
        href="/admin/clients?trainer=none"
        cta="Assignar"
      />,
    );
  }

  if (h.outOfAvailability.ok && h.outOfAvailability.data.total > 0) {
    const o = h.outOfAvailability.data;
    count += o.total;
    rows.push(
      <AttentionRow
        key="orphans"
        title={o.total === 1 ? "1 reserva fora d'horari" : `${o.total} reserves fora d'horari`}
        detail={
          <>
            {o.trainers.map((t, i) => (
              <span key={t.id}>
                {i > 0 && " · "}
                <Link href={`/admin/disponibilitat?trainer=${t.id}`} className="underline hover:text-brand-dark">
                  {firstName(t.name)} {t.count}
                </Link>
              </span>
            ))}
            {" · reserves, proves o esperes que ja no cauen en l'horari"}
          </>
        }
        href={`/admin/disponibilitat?trainer=${o.trainers[0].id}`}
        cta="Revisar"
      />,
    );
  } else if (!h.outOfAvailability.ok) {
    rows.push(<AttentionRow key="orphans-ko" title="No s'han pogut revisar les reserves fora d'horari" detail="Mira-ho a Disponibilitat." href="/admin/disponibilitat" cta="Revisar" />);
  }

  if (h.fullGroups.ok && h.fullGroups.data.length > 0) {
    const g = h.fullGroups.data;
    count += g.length;
    const at = g[0];
    rows.push(
      <AttentionRow
        key="groups"
        title={g.length === 1 ? "1 grup amb gent a la cua" : `${g.length} grups amb gent a la cua`}
        detail={
          <>
            {formatDate(at.at)} {formatTime(at.at)} · {firstName(at.trainerName)} · {at.booked}/{GROUP_CAPACITY}, {at.waiting.length} en espera
            {g.length > 1 && ` · i ${g.length - 1} més`}
          </>
        }
        href={`/admin/reservas?dia=${centerDateStr(new Date(at.at))}&pro=${at.trainerId}`}
        cta="Veure"
      />,
    );
  }

  if (a.referrals > 0) {
    count += a.referrals;
    rows.push(
      <AttentionRow
        key="referrals"
        title={a.referrals === 1 ? "1 recompensa de referit per aplicar" : `${a.referrals} recompenses de referit per aplicar`}
        detail="Descomptes guanyats que esperen la propera compra."
        href="/admin/referits"
        cta="Veure"
      />,
    );
  }

  if (rows.length === 0) return null;
  return (
    <AttentionPanel title="Per resoldre" count={count}>
      {rows}
    </AttentionPanel>
  );
}

/** L'agenda del professional, el dia de la seva sessió sense marcar més recent. */
function unmarkedHref(t: UnmarkedByTrainer["trainers"][number]) {
  const s = t.sessions[0];
  return s
    ? `/admin/reservas?dia=${centerDateStr(new Date(s.scheduledAt))}${t.id ? `&pro=${t.id}` : ""}`
    : "/admin/reservas";
}
