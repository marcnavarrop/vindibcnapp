import Link from "next/link";
import { TAP_SURFACE } from "@/lib/utils";
import { CENTER_TZ } from "@/lib/config";
import { GROUP_CAPACITY } from "@/lib/labels";
import { INBOX_DAYS } from "@/lib/inbox-window";
import { IconBox, type IconName } from "@/components/ui/home-icon";
import {
  UNMARKED_LIMIT,
  dayOf,
  type AgendaHealth,
  type FullGroup,
  type Loaded,
  type OutOfAvailability,
  type UnmarkedByTrainer,
} from "@/lib/data/admin-agenda-health";

/**
 * L'ESTAT DE L'AGENDA, A L'INICI DE L'ADMIN: tres targetes.
 *
 * Cada una porta a on es resol: la columna del professional a l'agenda
 * (`?dia=…&pro=…`) o el seu plafó de Disponibilitat. Si una lectura falla, la
 * seva targeta ho diu; un zero només vol dir zero.
 */

/** Quantes sessions es llisten per professional a «Sense marcar». */
const SHOWN_PER_TRAINER = 3;

const dayFmt = new Intl.DateTimeFormat("ca-ES", { weekday: "short", day: "numeric", month: "short", timeZone: CENTER_TZ });
const timeFmt = new Intl.DateTimeFormat("ca-ES", { hour: "2-digit", minute: "2-digit", timeZone: CENTER_TZ });
const when = (iso: string) => `${dayFmt.format(new Date(iso))} · ${timeFmt.format(new Date(iso))}`;
const agendaHref = (iso: string, trainerId: string | null) =>
  `/admin/reservas?dia=${dayOf(iso)}${trainerId ? `&pro=${encodeURIComponent(trainerId)}` : ""}`;

export function AgendaHealthCards({ h }: { h: AgendaHealth }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3" data-agenda-health>
      <Unmarked r={h.unmarked} />
      <OutOfAvailabilityCard r={h.outOfAvailability} />
      <FullGroups r={h.fullGroups} />
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  count,
  id,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  /** El número gran; `null` quan ha fallat (no es pinta cap zero). */
  count: number | string | null;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-brand-border bg-white p-5" aria-labelledby={`${id}-t`} data-card={id}>
      <div className="mb-3 flex items-center gap-2.5">
        <IconBox name={icon} />
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-t`} className="text-xs font-bold tracking-widest text-brand-muted uppercase">
            {title}
          </h2>
          <p className="text-xs text-brand-muted">{subtitle}</p>
        </div>
        {count !== null && (
          <span className="text-2xl font-bold text-brand-dark" data-count>
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Failed({ what }: { what: string }) {
  return (
    <p role="alert" className="text-sm text-error" data-failed>
      No s&apos;ha pogut carregar {what}. Torna-ho a provar d&apos;aquí a una estona.
    </p>
  );
}

const rowClass = `flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-bg ${TAP_SURFACE}`;

// ─────────────────── Sense marcar ───────────────────

function Unmarked({ r }: { r: Loaded<UnmarkedByTrainer> }) {
  const total = r.ok ? `${r.data.total}${r.data.truncated ? "+" : ""}` : null;
  return (
    <Card
      id="sense-marcar"
      icon="alert"
      title="Sense marcar"
      subtitle={`Sessions passades encara reservades · últims ${INBOX_DAYS} dies`}
      count={total}
    >
      {!r.ok ? (
        <Failed what="les sessions sense marcar" />
      ) : r.data.total === 0 ? (
        <p className="text-sm text-brand-muted">Cap sessió per marcar.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3" data-unmarked>
            {r.data.trainers.map((t) => (
              <li key={t.id ?? "cap"} data-unmarked-trainer={t.id ?? ""}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-bold text-brand-charcoal">{t.name}</span>
                  <span className="shrink-0 font-bold text-brand-orange-dark">{t.sessions.length}</span>
                </div>
                <ul className="mt-1 flex flex-col">
                  {t.sessions.slice(0, SHOWN_PER_TRAINER).map((s) => (
                    <li key={s.id}>
                      <Link href={agendaHref(s.scheduledAt, t.id)} className={rowClass} data-unmarked-session={s.id}>
                        <span className="shrink-0 text-brand-muted first-letter:uppercase">{when(s.scheduledAt)}</span>
                        <span className="truncate text-brand-dark">{s.clientName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {t.sessions.length > SHOWN_PER_TRAINER && (
                  <p className="px-2 text-xs text-brand-muted">i {t.sessions.length - SHOWN_PER_TRAINER} més</p>
                )}
              </li>
            ))}
          </ul>
          {r.data.truncated && (
            <p className="mt-3 text-xs text-brand-muted">
              Se&apos;n compten les {UNMARKED_LIMIT} més recents: n&apos;hi pot haver més.
            </p>
          )}
          <p className="mt-3 text-xs text-brand-muted">
            Una sessió que no es marca com a feta no es paga a les liquidacions.
          </p>
        </>
      )}
    </Card>
  );
}

// ─────────────────── Fora de disponibilitat ───────────────────

function OutOfAvailabilityCard({ r }: { r: Loaded<OutOfAvailability> }) {
  return (
    <Card
      id="fora-disponibilitat"
      icon="calendar"
      title="Fora de disponibilitat"
      subtitle="Reserves, proves i esperes que ja no cauen en l'horari del seu professional"
      count={r.ok ? r.data.total : null}
    >
      {!r.ok ? (
        <Failed what="el recompte de reserves fora de disponibilitat" />
      ) : r.data.total === 0 ? (
        <p className="text-sm text-brand-muted">Cap: tot cau dins de l&apos;horari de cadascú.</p>
      ) : (
        <ul className="flex flex-col" data-orphans>
          {r.data.trainers.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/disponibilitat?trainer=${encodeURIComponent(t.id)}`} className={rowClass} data-orphans-trainer={t.id}>
                <span className="flex-1 truncate text-brand-dark">{t.name}</span>
                <span className="font-bold text-brand-orange-dark">{t.count}</span>
                <span className="text-xs font-bold text-brand-purple">Revisar →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─────────────────── Grups plens amb espera ───────────────────

function FullGroups({ r }: { r: Loaded<FullGroup[]> }) {
  return (
    <Card
      id="grups-espera"
      icon="user"
      title="Grups amb espera"
      subtitle="Plens i amb gent a la cua · d'ara a diumenge"
      count={r.ok ? r.data.length : null}
    >
      {!r.ok ? (
        <Failed what="els grups amb llista d'espera" />
      ) : r.data.length === 0 ? (
        <p className="text-sm text-brand-muted">Cap grup amb gent esperant aquesta setmana.</p>
      ) : (
        <ul className="flex flex-col" data-full-groups>
          {r.data.map((g) => (
            <li key={`${g.trainerId}|${g.at}`}>
              <Link
                href={agendaHref(g.at, g.trainerId)}
                className={`flex min-h-11 flex-col rounded-lg px-2 py-1.5 text-sm hover:bg-brand-bg ${TAP_SURFACE}`}
                data-full-group={`${g.trainerId}|${g.at}`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="shrink-0 text-brand-muted first-letter:uppercase">{when(g.at)}</span>
                  <span className="truncate text-brand-dark">{g.trainerName}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className={g.booked >= GROUP_CAPACITY ? "font-bold text-brand-dark" : "text-brand-muted"}>
                    {g.booked}/{GROUP_CAPACITY}
                  </span>
                  <span className="font-bold text-brand-orange-dark">+{g.waiting.length} en espera</span>
                </span>
                <span className="truncate text-xs text-brand-muted">{g.waiting.join(", ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
