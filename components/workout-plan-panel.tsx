"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import {
  VideoIndicator,
  VideoDialog,
  videoKind,
  LIBRARY_TEXTS_CA,
} from "@/components/exercise-library";
import {
  assignPlanExerciseAction,
  createDayAction,
  deleteDayAction,
  duplicateDayAction,
  movePlanExerciseAction,
  removePlanExerciseAction,
  renameDayAction,
  reorderDaysAction,
  reorderPlanExercisesAction,
  updatePautaAction,
  type PlanResult,
} from "@/app/actions/workout-plan-actions";
import type { AssignedExercise, WorkoutPlan, WorkoutDay } from "@/lib/data/client-exercises";
import type { Exercise } from "@/lib/data/exercises";
import { formatRest, moveInList, PAUTA_MAX } from "@/lib/workout-pauta";
import { formatDate } from "@/lib/labels";
import { TAP, clsx } from "@/lib/utils";

/**
 * La pauta per dies d'un client, a la pestanya «Entrenament» de la fitxa
 * (admin i professional). Català fix, com tota l'àrea de l'equip.
 *
 * Pestanyes «Dia 1 · Dia 2 · … · Sense dia · + Dia». Dins de cada dia, els
 * exercicis en ordre, amb la pauta, fletxes ↑↓, «Moure a…» i «Pauta» per
 * editar-la. Sense `canManage` (un professional que no és el del client) tot
 * és de lectura: la RLS tampoc el deixaria escriure.
 *
 * Moure un exercici és canviar-li el dia, mai treure'l i tornar-lo a posar: el
 * progrés penja de l'assignació i es perdria.
 */

const NONE = "none" as const;
type Tab = string; // id del dia, o NONE

export function dayLabel(d: Pick<WorkoutDay, "number" | "name">): string {
  return d.name ? `Dia ${d.number} · ${d.name}` : `Dia ${d.number}`;
}

export function pautaSummary(a: Pick<AssignedExercise, "sets" | "reps" | "load" | "restSeconds">): string {
  const parts: string[] = [];
  if (a.sets != null && a.reps) parts.push(`${a.sets} × ${a.reps}`);
  else if (a.sets != null) parts.push(`${a.sets} ${a.sets === 1 ? "sèrie" : "sèries"}`);
  else if (a.reps) parts.push(a.reps);
  if (a.load) parts.push(a.load);
  if (a.restSeconds != null) parts.push(`descans ${formatRest(a.restSeconds)}`);
  return parts.join(" · ");
}

const INPUT =
  "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple";
const LABEL = "text-xs font-bold tracking-wide text-brand-muted uppercase";
const SMALL_BTN = `min-h-11 rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-purple hover:bg-brand-bg disabled:opacity-40 md:min-h-9 ${TAP}`;
const PRIMARY = `min-h-11 rounded-lg bg-brand-purple px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark disabled:opacity-50 md:min-h-9 ${TAP}`;

export function WorkoutPlanPanel({
  clientId,
  plan,
  library,
  canManage,
}: {
  clientId: string;
  plan: WorkoutPlan;
  library: Exercise[];
  canManage: boolean;
}) {
  const { days, exercises, logs } = plan;
  const unassigned = exercises.filter((e) => e.dayId === null);
  const firstTab: Tab = days[0]?.id ?? NONE;
  const [tab, setTab] = useState<Tab>(firstTab);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [playing, setPlaying] = useState<AssignedExercise | null>(null);

  // Si el dia obert desapareix (esborrat, o una altra pestanya), torna al primer.
  const tabExists = tab === NONE || days.some((d) => d.id === tab);
  const current: Tab = tabExists ? tab : firstTab;
  const day = days.find((d) => d.id === current) ?? null;
  const list = exercises.filter((e) => (current === NONE ? e.dayId === null : e.dayId === current));

  function run(fn: () => Promise<PlanResult>, after?: (r: PlanResult) => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else after?.(r);
    });
  }

  const lastDone = (dayId: string) => logs.find((l) => l.dayId === dayId)?.doneOn ?? null;
  const showNone = unassigned.length > 0 || days.length === 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="border-b border-brand-border bg-brand-bg px-4 py-3 sm:px-5">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">Pauta per dies</h2>
        <p className="mt-0.5 text-xs text-brand-muted">
          Els dies van en cicle: quan acaba l&apos;últim, torna a començar pel primer.
        </p>
      </div>

      {/* Pestanyes de dia. Fan salt de línia: a 375 px no hi ha desplaçament lateral. */}
      <div role="tablist" aria-label="Dies de la pauta" className="flex flex-wrap gap-2 border-b border-brand-border px-4 py-3 sm:px-5">
        {days.map((d) => (
          <TabButton key={d.id} active={current === d.id} onClick={() => setTab(d.id)}>
            {dayLabel(d)}
            <span className="ml-1.5 text-xs opacity-70">
              ({exercises.filter((e) => e.dayId === d.id).length})
            </span>
          </TabButton>
        ))}
        {showNone && (
          <TabButton active={current === NONE} onClick={() => setTab(NONE)}>
            Sense dia <span className="ml-1.5 text-xs opacity-70">({unassigned.length})</span>
          </TabButton>
        )}
        {canManage && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => createDayAction(clientId, ""), (r) => r.ok && r.id && setTab(r.id))}
            className={`min-h-11 rounded-full border border-dashed border-brand-purple/50 px-4 text-sm font-bold text-brand-purple hover:bg-brand-purple/5 disabled:opacity-50 md:min-h-9 ${TAP}`}
          >
            + Dia
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="border-b border-brand-border bg-error/5 px-4 py-2 text-sm text-error sm:px-5">
          {error}
        </p>
      )}

      {/* Capçalera del dia obert */}
      {day && (
        <DayToolbar
          key={`toolbar-${day.id}-${day.name ?? ""}`}
          clientId={clientId}
          day={day}
          days={days}
          canManage={canManage}
          pending={pending}
          lastDone={lastDone(day.id)}
          count={list.length}
          run={run}
          onDuplicated={(id) => setTab(id)}
        />
      )}
      {current === NONE && (
        <p className="border-b border-brand-border px-4 py-3 text-sm text-brand-muted sm:px-5">
          {days.length === 0
            ? "Encara no hi ha cap dia. Crea'n un amb «+ Dia» i mou-hi els exercicis."
            : "Exercicis que encara no són a cap dia. El client els veu a part, després dels dies."}
        </p>
      )}

      {/* Exercicis del dia */}
      {list.length === 0 ? (
        <p className="px-4 py-4 text-sm text-brand-muted sm:px-5">
          {current === NONE ? "No n'hi ha cap." : "Aquest dia encara no té exercicis."}
        </p>
      ) : (
        <ol className="divide-y divide-brand-border">
          {list.map((a, i) => (
            <ExerciseRow
              key={a.id}
              clientId={clientId}
              a={a}
              index={i}
              total={list.length}
              days={days}
              canManage={canManage}
              pending={pending}
              onUp={() => {
                const ids = moveInList(list.map((x) => x.id), i, -1);
                if (ids) run(() => reorderPlanExercisesAction(clientId, a.dayId, ids));
              }}
              onDown={() => {
                const ids = moveInList(list.map((x) => x.id), i, 1);
                if (ids) run(() => reorderPlanExercisesAction(clientId, a.dayId, ids));
              }}
              onMove={(to) => run(() => movePlanExerciseAction(clientId, a.id, to))}
              onPlay={() => setPlaying(a)}
            />
          ))}
        </ol>
      )}

      {canManage && library.length > 0 && (
        <AssignForm
          key={`assign-${current}`}
          clientId={clientId}
          dayId={current === NONE ? null : current}
          target={day ? dayLabel(day) : "Sense dia"}
          library={library}
        />
      )}

      <DoneHistory logs={logs} days={days} />

      {playing && (
        <VideoDialog exercise={playing} texts={LIBRARY_TEXTS_CA} onClose={() => setPlaying(null)} />
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        `min-h-11 rounded-full border px-4 text-sm font-bold md:min-h-9 ${TAP}`,
        active
          ? "border-brand-purple bg-brand-purple text-white"
          : "border-brand-border bg-white text-brand-charcoal hover:border-brand-purple/50",
      )}
    >
      {children}
    </button>
  );
}

function DayToolbar({
  clientId,
  day,
  days,
  canManage,
  pending,
  lastDone,
  count,
  run,
  onDuplicated,
}: {
  clientId: string;
  day: WorkoutDay;
  days: WorkoutDay[];
  canManage: boolean;
  pending: boolean;
  lastDone: string | null;
  count: number;
  run: (fn: () => Promise<PlanResult>, after?: (r: PlanResult) => void) => void;
  onDuplicated: (id: string) => void;
}) {
  const [name, setName] = useState(day.name ?? "");
  const idx = days.findIndex((d) => d.id === day.id);
  const ids = days.map((d) => d.id);
  const changed = (name.trim() || null) !== (day.name ?? null);

  return (
    <div className="flex flex-col gap-3 border-b border-brand-border px-4 py-3 sm:px-5">
      <p className="text-sm text-brand-muted">
        {lastDone ? (
          <>
            Últim cop que el client l&apos;ha marcat fet: <b className="text-brand-dark">{formatDate(lastDone)}</b>
          </>
        ) : (
          "El client encara no l'ha marcat mai com a fet."
        )}
      </p>

      {canManage && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <form
            className="flex flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameDayAction(clientId, day.id, name));
            }}
          >
            <label className="flex flex-1 flex-col gap-1">
              <span className={LABEL}>Nom del dia (opcional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={PAUTA_MAX.name}
                placeholder={`Dia ${day.number}`}
                className={INPUT}
              />
            </label>
            <button type="submit" disabled={pending || !changed} className={SMALL_BTN}>
              Desar
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || idx <= 0}
              aria-label={`Passar ${dayLabel(day)} abans`}
              onClick={() => {
                const next = moveInList(ids, idx, -1);
                if (next) run(() => reorderDaysAction(clientId, next));
              }}
              className={SMALL_BTN}
            >
              ← Abans
            </button>
            <button
              type="button"
              disabled={pending || idx >= days.length - 1}
              aria-label={`Passar ${dayLabel(day)} després`}
              onClick={() => {
                const next = moveInList(ids, idx, 1);
                if (next) run(() => reorderDaysAction(clientId, next));
              }}
              className={SMALL_BTN}
            >
              Després →
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => duplicateDayAction(clientId, day.id), (r) => r.ok && r.id && onDuplicated(r.id))}
              className={SMALL_BTN}
            >
              Duplicar
            </button>
            <ConfirmInline
              compact
              action={async () => {
                run(() => deleteDayAction(clientId, day.id));
              }}
              trigger="Esborrar"
              triggerClassName={`min-h-11 rounded-lg px-3 text-sm font-bold text-brand-muted hover:text-error md:min-h-9 ${TAP}`}
              question={`Esborrar ${dayLabel(day)}?`}
              consequence={
                count > 0
                  ? `${count === 1 ? "El seu exercici passa" : `Els seus ${count} exercicis passen`} a «Sense dia», amb el progrés. No se n'esborra cap.`
                  : "No té cap exercici."
              }
              confirmLabel="Sí, esborra'l"
              pendingLabel="Esborrant…"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ExerciseRow({
  clientId,
  a,
  index,
  total,
  days,
  canManage,
  pending,
  onUp,
  onDown,
  onMove,
  onPlay,
}: {
  clientId: string;
  a: AssignedExercise;
  index: number;
  total: number;
  days: WorkoutDay[];
  canManage: boolean;
  pending: boolean;
  onUp: () => void;
  onDown: () => void;
  onMove: (dayId: string | null) => void;
  onPlay: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const summary = pautaSummary(a);
  const targets = [
    ...days.filter((d) => d.id !== a.dayId).map((d) => ({ value: d.id, label: dayLabel(d) })),
    ...(a.dayId !== null ? [{ value: NONE, label: "Sense dia" }] : []),
  ];

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-6 shrink-0 text-right text-sm font-bold text-brand-muted tabular-nums">
          {index + 1}.
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-bold text-brand-dark">{a.name}</h3>
            <Badge tone="info">{a.categoryName}</Badge>
          </div>
          <p className={clsx("mt-0.5 text-sm", summary ? "font-bold text-brand-purple" : "text-brand-muted")}>
            {summary || "Sense pauta"}
          </p>
          {a.notes && <p className="mt-0.5 text-sm text-brand-charcoal">{a.notes}</p>}
        </div>
        <VideoIndicator kind={videoKind(a)} url={a.videoUrl} texts={LIBRARY_TEXTS_CA} onPlay={onPlay} />
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 pl-9">
          <button type="button" disabled={pending || index === 0} onClick={onUp} aria-label={`Pujar «${a.name}»`} className={SMALL_BTN}>
            ↑
          </button>
          <button type="button" disabled={pending || index === total - 1} onClick={onDown} aria-label={`Baixar «${a.name}»`} className={SMALL_BTN}>
            ↓
          </button>
          {targets.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Moure «{a.name}» a</span>
              <select
                disabled={pending}
                value=""
                onChange={(e) => e.target.value && onMove(e.target.value === NONE ? null : e.target.value)}
                className="min-h-11 rounded-lg border border-brand-border bg-white px-2 text-sm text-brand-charcoal md:min-h-9"
              >
                <option value="">Moure a…</option>
                {targets.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className={SMALL_BTN}>
            {editing ? "Tancar la pauta" : "Pauta"}
          </button>
          <div className="ml-auto">
            <ConfirmInline
              compact
              action={removePlanExerciseAction.bind(null, clientId)}
              fields={{ id: a.id }}
              trigger="Treure"
              triggerClassName={`min-h-11 text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error md:min-h-9 ${TAP}`}
              question={`Treure «${a.name}» d'aquest dia?`}
              consequence="També s'esborra el progrés que s'hi hagi registrat. Per canviar-lo de dia, fes servir «Moure a…»."
              confirmLabel="Sí, treu-lo"
              pendingLabel="Traient…"
            />
          </div>
        </div>
      )}

      {canManage && editing && (
        <PautaForm clientId={clientId} a={a} onSaved={() => setEditing(false)} />
      )}
    </li>
  );
}

function PautaFields({ a }: { a?: Partial<AssignedExercise> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Sèries</span>
        <input name="sets" inputMode="numeric" pattern="[0-9]*" defaultValue={a?.sets ?? ""} placeholder="3" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Reps o temps</span>
        <input name="reps" maxLength={PAUTA_MAX.reps} defaultValue={a?.reps ?? ""} placeholder="8-10 · 30 s" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Càrrega</span>
        <input name="load" maxLength={PAUTA_MAX.load} defaultValue={a?.load ?? ""} placeholder="20 kg · RPE 7" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Descans (s)</span>
        <input name="restSeconds" inputMode="numeric" pattern="[0-9]*" defaultValue={a?.restSeconds ?? ""} placeholder="90" className={INPUT} />
      </label>
    </div>
  );
}

function PautaForm({ clientId, a, onSaved }: { clientId: string; a: AssignedExercise; onSaved: () => void }) {
  const [state, action, pending] = useActionState(updatePautaAction.bind(null, clientId, a.id), null);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);
  return (
    <form action={action} className="ml-9 flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-bg/50 p-3">
      <PautaFields a={a} />
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Notes</span>
        <input name="notes" maxLength={PAUTA_MAX.notes} defaultValue={a.notes ?? ""} placeholder="Baixa a poc a poc, esquena recta" className={INPUT} />
      </label>
      {state && !state.ok && <p role="alert" className="text-sm text-error">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Desant…" : "Desar la pauta"}
        </button>
      </div>
    </form>
  );
}

function AssignForm({
  clientId,
  dayId,
  target,
  library,
}: {
  clientId: string;
  dayId: string | null;
  target: string;
  library: Exercise[];
}) {
  const [state, action, pending] = useActionState(assignPlanExerciseAction.bind(null, clientId), null);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state?.ok) setFormKey((k) => k + 1); // buida el formulari després d'assignar
  }, [state]);
  return (
    <form key={formKey} action={action} className="flex flex-col gap-3 border-t border-brand-border bg-brand-bg/40 px-4 py-4 sm:px-5">
      <p className="text-sm font-bold text-brand-dark">Afegir un exercici a {target}</p>
      <input type="hidden" name="dayId" value={dayId ?? ""} />
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Exercici</span>
        <select name="exerciseId" required defaultValue="" className={INPUT}>
          <option value="" disabled>
            Tria un exercici…
          </option>
          {library.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <PautaFields />
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Notes (opcional)</span>
        <input name="notes" maxLength={PAUTA_MAX.notes} placeholder="Baixa a poc a poc, esquena recta" className={INPUT} />
      </label>
      {state && !state.ok && <p role="alert" className="text-sm text-error">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Assignant…" : "Assignar"}
        </button>
      </div>
    </form>
  );
}

function DoneHistory({ logs, days }: { logs: WorkoutPlan["logs"]; days: WorkoutDay[] }) {
  const recent = logs.slice(0, 10);
  return (
    <div className="border-t border-brand-border px-4 py-4 sm:px-5">
      <h3 className={LABEL}>«Dia fet» recents</h3>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-brand-muted">El client encara no ha marcat cap dia com a fet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {recent.map((l) => {
            // El nom i el número d'ara si el dia encara hi és; si no, la foto de quan es va marcar.
            const live = l.dayId ? days.find((d) => d.id === l.dayId) : null;
            const label = live ? dayLabel(live) : `${dayLabel({ number: l.dayNumber, name: l.dayName })} (esborrat)`;
            return (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="shrink-0 text-brand-muted tabular-nums">{formatDate(l.doneOn)}</span>
                <span className="font-bold text-brand-dark">{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
