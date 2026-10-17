"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { TestChart, TestHeadline, chartAria } from "@/components/client-tests/test-visuals";
import {
  addEntryAction,
  createTestAction,
  deleteEntryAction,
  deleteTestAction,
  reorderTestsAction,
  updateEntryAction,
  updateTestAction,
  type TestResult,
} from "@/app/actions/client-tests-actions";
import type { ClientTest, ClientTestEntry, TestSuggestion } from "@/lib/data/client-tests";
import { TEST_MAX, formatValue, titleKey, withUnit, type BetterWhen } from "@/lib/client-tests";
import { moveInList } from "@/lib/workout-pauta";
import { formatDate } from "@/lib/labels";
import { TAP, clsx, normalizeForSearch } from "@/lib/utils";

/**
 * Els tests d'avaluació d'un client (0113), a la pestanya «Tests» de la fitxa
 * (admin i professional). Català fix, com tota l'àrea de l'equip.
 *
 * Cada test és una targeta: la darrera marca amb la diferència respecte de
 * l'anterior (verd si millora, vermell si empitjora, gris si és neutre), la
 * gràfica i els registres. Sense `canManage` tot és de lectura (un fisio que no
 * és l'assignat, 0114): la RLS tampoc el deixaria escriure.
 *
 * En escriure el títol d'un test nou se suggereixen els que ja es fan servir al
 * centre (amb la unitat): només suggeriment, per no acabar amb «Dominades» i
 * «dominadas». El test és del client.
 */

const INPUT =
  "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple";
const LABEL = "text-xs font-bold tracking-wide text-brand-muted uppercase";
const SMALL_BTN = `min-h-11 rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-purple hover:bg-brand-bg disabled:opacity-40 md:min-h-9 ${TAP}`;
const PRIMARY = `min-h-11 rounded-lg bg-brand-purple px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark disabled:opacity-50 md:min-h-9 ${TAP}`;
const DELETE_TRIGGER = `min-h-11 rounded-lg px-3 text-sm font-bold text-brand-muted hover:text-error md:min-h-9 ${TAP}`;

const BETTER_LABEL: Record<BetterWhen, string> = {
  neutral: "Neutre (sense color)",
  up: "Millor si puja",
  down: "Millor si baixa",
};

const HEADLINE_LABELS = { last: "Darrera marca", vsPrevious: "respecte de l'anterior", none: "Encara no hi ha cap registre." };
const ariaCa = (v: { title: string; first: string; last: string; from: string; to: string }) =>
  `${v.title}: de ${v.first} (${v.from}) a ${v.last} (${v.to}).`;

export function ClientTestsPanel({
  clientId,
  tests,
  suggestions,
  canManage,
  healthConsent,
  today,
}: {
  clientId: string;
  tests: ClientTest[];
  suggestions: TestSuggestion[];
  canManage: boolean;
  /**
   * El client té signat el consentiment de dades de salut. Sense, no es poden
   * CREAR tests ni registres (0117); el que ja hi ha es pot editar i esborrar.
   */
  healthConsent: boolean;
  /** Avui a l'hora del centre (YYYY-MM-DD): la data per defecte i el màxim. */
  today: string;
}) {
  const canCreate = canManage && healthConsent;
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ids = tests.map((t) => t.id);
  const takenTitles = tests.map((t) => ({ id: t.id, key: titleKey(t.title), title: t.title }));

  function run(fn: () => Promise<TestResult>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">Tests d&apos;avaluació</h2>
          <p className="mt-0.5 text-xs text-brand-muted">
            {canManage
              ? "Cada test és d'aquest client: títol, unitat i registres amb data. El client els veu a la seva àrea."
              : "Només lectura: els crea i els omple el professional assignat (o l'administració)."}
          </p>
        </div>
        {canCreate && !creating && (
          <button type="button" onClick={() => setCreating(true)} className={PRIMARY}>
            + Nou test
          </button>
        )}
      </div>

      {/* Els tests són dades de salut (0117): el mateix avís i el mateix camí que
          l'historial clínic. Aquí, a més, no es pot afegir res fins que el signi. */}
      {canManage && !healthConsent && (
        <p className="rounded-xl border border-attention bg-attention-bg px-3.5 py-2.5 text-sm text-attention" data-consent-missing>
          <b className="font-bold">Consentiment de dades de salut pendent.</b> Els tests són dades de salut:
          no s&apos;hi poden afegir tests ni registres fins que l&apos;accepti des de la seva àrea
          (Configuració → Privacitat i consentiments). El que ja hi ha es pot consultar, editar i esborrar.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-error/5 px-4 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {canCreate && creating && (
        <NewTestForm
          clientId={clientId}
          suggestions={suggestions}
          takenTitles={takenTitles}
          onDone={() => setCreating(false)}
        />
      )}

      {tests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-brand-border bg-white px-5 py-6 text-center text-sm text-brand-muted">
          {canCreate
            ? "Encara no hi ha cap test. Crea'n un amb «+ Nou test» (p. ex. «Dominades», «Perímetre abdominal»)."
            : "Aquest client encara no té cap test."}
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {tests.map((t, i) => (
            <TestCard
              key={t.id}
              clientId={clientId}
              test={t}
              canManage={canManage}
              canCreate={canCreate}
              pending={pending}
              today={today}
              suggestions={suggestions}
              takenTitles={takenTitles}
              isFirst={i === 0}
              isLast={i === tests.length - 1}
              onMove={(dir) => {
                const next = moveInList(ids, i, dir);
                if (next) run(() => reorderTestsAction(clientId, next));
              }}
              onDelete={() => run(() => deleteTestAction(clientId, t.id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Un test ────────────────────────────────────────────────────────────────

function TestCard({
  clientId,
  test,
  canManage,
  canCreate,
  pending,
  today,
  suggestions,
  takenTitles,
  isFirst,
  isLast,
  onMove,
  onDelete,
}: {
  clientId: string;
  test: ClientTest;
  canManage: boolean;
  /** Es poden afegir registres (hi ha consentiment de salut, 0117). */
  canCreate: boolean;
  pending: boolean;
  today: string;
  suggestions: TestSuggestion[];
  takenTitles: TakenTitle[];
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const { entries } = test;
  const n = entries.length;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-white">
      <header className="flex flex-col gap-1 border-b border-brand-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-base font-bold text-brand-dark">{test.title}</h3>
          {test.unit && <span className="text-sm text-brand-muted">({test.unit})</span>}
          {test.betterWhen !== "neutral" && (
            <span className="text-xs font-bold text-brand-muted">
              {test.betterWhen === "up" ? "↑ millor si puja" : "↓ millor si baixa"}
            </span>
          )}
        </div>
        {test.description && <p className="text-sm whitespace-pre-line text-brand-charcoal">{test.description}</p>}
      </header>

      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        <TestHeadline entries={entries} unit={test.unit} betterWhen={test.betterWhen} locale="ca" labels={HEADLINE_LABELS} />
        {n > 0 && (
          <TestChart entries={entries} unit={test.unit} locale="ca" ariaLabel={chartAria(test.title, entries, test.unit, "ca", ariaCa)} />
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 border-t border-brand-border px-4 py-3 sm:px-5">
          {canCreate && (
            <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className={SMALL_BTN}>
              {adding ? "Tancar" : "+ Registre"}
            </button>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className={SMALL_BTN}>
            {editing ? "Tancar l'edició" : "Editar"}
          </button>
          <button type="button" disabled={pending || isFirst} onClick={() => onMove(-1)} aria-label={`Pujar «${test.title}»`} className={SMALL_BTN}>
            ↑
          </button>
          <button type="button" disabled={pending || isLast} onClick={() => onMove(1)} aria-label={`Baixar «${test.title}»`} className={SMALL_BTN}>
            ↓
          </button>
          <div className="ml-auto">
            <ConfirmInline
              compact
              action={async () => onDelete()}
              trigger="Esborrar"
              triggerClassName={DELETE_TRIGGER}
              question={`Esborrar el test «${test.title}»?`}
              consequence={
                n > 0
                  ? `S'esborren també ${n === 1 ? "el seu registre" : `els seus ${n} registres`}. No es pot desfer.`
                  : "No té cap registre."
              }
              confirmLabel="Sí, esborra'l"
              pendingLabel="Esborrant…"
            />
          </div>
        </div>
      )}

      {canCreate && adding && (
        <EntryForm
          action={addEntryAction.bind(null, clientId, test.id)}
          today={today}
          unit={test.unit}
          submitLabel="Afegir el registre"
          onSaved={() => setAdding(false)}
        />
      )}

      {canManage && editing && (
        <TestForm
          action={updateTestAction.bind(null, clientId, test.id)}
          test={test}
          suggestions={suggestions}
          takenTitles={takenTitles}
          submitLabel="Desar el test"
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )}

      {n > 0 && <EntryList clientId={clientId} test={test} canManage={canManage} today={today} />}
    </article>
  );
}

// ─── Registres ──────────────────────────────────────────────────────────────

/** Els registres, del més nou al més antic. Plegats si n'hi ha molts. */
function EntryList({
  clientId,
  test,
  canManage,
  today,
}: {
  clientId: string;
  test: ClientTest;
  canManage: boolean;
  today: string;
}) {
  const newestFirst = [...test.entries].reverse();
  return (
    <details className="group border-t border-brand-border" open={newestFirst.length <= 3}>
      <summary className={`flex min-h-11 cursor-pointer items-center px-4 text-sm font-bold text-brand-purple sm:px-5 ${TAP}`}>
        Registres ({newestFirst.length})
      </summary>
      <ul className="divide-y divide-brand-border border-t border-brand-border">
        {newestFirst.map((e) => (
          <EntryRow key={e.id} clientId={clientId} entry={e} unit={test.unit} canManage={canManage} today={today} />
        ))}
      </ul>
    </details>
  );
}

function EntryRow({
  clientId,
  entry,
  unit,
  canManage,
  today,
}: {
  clientId: string;
  entry: ClientTestEntry;
  unit: string | null;
  canManage: boolean;
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valueText = withUnit(formatValue(entry.value, "ca"), unit);

  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="w-32 shrink-0 whitespace-nowrap text-brand-muted tabular-nums">{formatDate(entry.measuredOn)}</span>
        <span className="font-bold text-brand-dark tabular-nums">{valueText}</span>
        {entry.notes && <span className="min-w-0 basis-full text-brand-charcoal sm:basis-auto">{entry.notes}</span>}
        {canManage && (
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
              aria-label={`Editar el registre del ${formatDate(entry.measuredOn)}`}
              className={`min-h-11 rounded-lg px-2 text-xs font-bold tracking-wide text-brand-purple uppercase hover:underline md:min-h-9 ${TAP}`}
            >
              {editing ? "Tancar" : "Editar"}
            </button>
            <ConfirmInline
              compact
              action={async () => {
                setError(null);
                start(async () => {
                  const r = await deleteEntryAction(clientId, entry.id);
                  if (!r.ok) setError(r.error);
                });
              }}
              pending={pending}
              trigger="Treure"
              triggerClassName={`min-h-11 px-2 text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error md:min-h-9 ${TAP}`}
              triggerAriaLabel={`Treure el registre del ${formatDate(entry.measuredOn)}`}
              question={`Treure el registre del ${formatDate(entry.measuredOn)} (${valueText})?`}
              confirmLabel="Sí, treu-lo"
              pendingLabel="Traient…"
            />
          </span>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {canManage && editing && (
        <EntryForm
          action={updateEntryAction.bind(null, clientId, entry.id)}
          today={today}
          unit={unit}
          entry={entry}
          submitLabel="Desar"
          onSaved={() => setEditing(false)}
          inset
        />
      )}
    </li>
  );
}

function EntryForm({
  action: bound,
  today,
  unit,
  entry,
  submitLabel,
  onSaved,
  inset = false,
}: {
  action: (prev: TestResult | null, fd: FormData) => Promise<TestResult>;
  today: string;
  unit: string | null;
  entry?: ClientTestEntry;
  submitLabel: string;
  onSaved: () => void;
  inset?: boolean;
}) {
  const [state, action, pending] = useActionState(bound, null);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);
  return (
    <form
      action={action}
      className={clsx(
        "flex flex-col gap-3",
        inset ? "rounded-xl border border-brand-border bg-brand-bg/50 p-3" : "border-t border-brand-border bg-brand-bg/40 px-4 py-4 sm:px-5",
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Data</span>
          <input type="date" name="measuredOn" required max={today} defaultValue={entry?.measuredOn ?? today} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Valor{unit ? ` (${unit})` : ""}</span>
          <input
            name="value"
            required
            inputMode="decimal"
            autoComplete="off"
            defaultValue={entry ? formatValue(entry.value, "ca").replace(/\./g, "") : ""}
            placeholder="12,5"
            className={INPUT}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Observacions (opcional)</span>
        <input name="notes" maxLength={TEST_MAX.notes} defaultValue={entry?.notes ?? ""} placeholder="Amb goma, després d'escalfar…" className={INPUT} />
      </label>
      {state && !state.ok && <p role="alert" className="text-sm text-error">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Desant…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── Crear i editar un test ─────────────────────────────────────────────────

type TakenTitle = { id: string; key: string; title: string };

function NewTestForm({
  clientId,
  suggestions,
  takenTitles,
  onDone,
}: {
  clientId: string;
  suggestions: TestSuggestion[];
  takenTitles: TakenTitle[];
  onDone: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-purple/40 bg-white">
      <p className="border-b border-brand-border bg-brand-bg px-4 py-3 text-sm font-bold text-brand-dark sm:px-5">Nou test</p>
      <TestForm
        action={createTestAction.bind(null, clientId)}
        suggestions={suggestions}
        takenTitles={takenTitles}
        submitLabel="Crear el test"
        onSaved={onDone}
        onCancel={onDone}
      />
    </div>
  );
}

function TestForm({
  action: bound,
  test,
  suggestions,
  takenTitles,
  submitLabel,
  onSaved,
  onCancel,
}: {
  action: (prev: TestResult | null, fd: FormData) => Promise<TestResult>;
  test?: ClientTest;
  suggestions: TestSuggestion[];
  takenTitles: TakenTitle[];
  submitLabel: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(bound, null);
  const [title, setTitle] = useState(test?.title ?? "");
  const [unit, setUnit] = useState(test?.unit ?? "");
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  const key = titleKey(title);
  const clash = key ? takenTitles.find((t) => t.key === key && t.id !== test?.id) : undefined;
  const q = normalizeForSearch(title).trim();
  // Sense res escrit, els més fets servir; escrivint, els que hi coincideixen.
  const shown = suggestions
    .filter((s) => (q ? normalizeForSearch(s.title).includes(q) : true))
    .filter((s) => !(titleKey(s.title) === key && (s.unit ?? "") === unit.trim()))
    .slice(0, 6);

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-brand-border bg-brand-bg/40 px-4 py-4 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Títol</span>
          <input
            name="title"
            required
            maxLength={TEST_MAX.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
            placeholder="Dominades, Perímetre abdominal…"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Unitat (opcional)</span>
          <input
            name="unit"
            maxLength={TEST_MAX.unit}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            autoComplete="off"
            placeholder="reps, cm, s, kg…"
            className={INPUT}
          />
        </label>
      </div>

      {clash && (
        <p role="status" className="text-sm text-error">
          Aquest client ja té el test «{clash.title}». Afegeix-hi registres en comptes de crear-ne un altre.
        </p>
      )}

      {shown.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-brand-muted">
            {q ? "Ja es fan servir al centre:" : "Els més fets servir al centre:"}
          </span>
          <div className="flex flex-wrap gap-2">
            {shown.map((s) => (
              <button
                key={`${s.title}|${s.unit ?? ""}`}
                type="button"
                onClick={() => {
                  setTitle(s.title);
                  setUnit(s.unit ?? "");
                }}
                className={`min-h-11 rounded-full border border-brand-border bg-white px-3 text-sm text-brand-charcoal hover:border-brand-purple/50 md:min-h-9 ${TAP}`}
              >
                <b className="font-bold text-brand-dark">{s.title}</b>
                {s.unit && <span className="text-brand-muted"> · {s.unit}</span>}
                <span className="ml-1 text-xs text-brand-muted">({s.uses})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Quan és millor</span>
        <select name="betterWhen" defaultValue={test?.betterWhen ?? "neutral"} className={INPUT}>
          {(["neutral", "up", "down"] as const).map((b) => (
            <option key={b} value={b}>
              {BETTER_LABEL[b]}
            </option>
          ))}
        </select>
        <span className="text-xs text-brand-muted">
          Pinta la diferència amb el registre anterior: verd si millora, vermell si empitjora.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Descripció (opcional)</span>
        <textarea
          name="description"
          rows={2}
          maxLength={TEST_MAX.description}
          defaultValue={test?.description ?? ""}
          placeholder="Com es fa: posició, material, repòs…"
          className={INPUT}
        />
      </label>

      {state && !state.ok && <p role="alert" className="text-sm text-error">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !!clash} className={PRIMARY}>
          {pending ? "Desant…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={SMALL_BTN}>
          Cancel·lar
        </button>
      </div>
    </form>
  );
}
