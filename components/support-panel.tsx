"use client";

import { useActionState, useEffect, useState } from "react";
import { Field } from "@/components/ui/input";
import { TextAreaField } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  formatDate,
} from "@/lib/labels";
import type { SupportFormState } from "@/lib/data/support-actions-core";
import type { SupportTicket } from "@/lib/data/support";
import type { SupportCategory, SupportStatus } from "@/types/database";

type Action = (
  prev: SupportFormState,
  fd: FormData,
) => Promise<SupportFormState>;

/** Un color per categoria, perquè es distingeixin d'un cop d'ull al llistat. */
const CATEGORY_STYLE: Record<
  SupportCategory,
  { color: string; icon: React.ReactNode }
> = {
  bug: {
    color: "#dc2626",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" /><line x1="12" y1="7" x2="12" y2="13" /><line x1="12" y1="17" x2="12" y2="17" />
      </svg>
    ),
  },
  pregunta: {
    color: "#2563eb",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7" /><line x1="12" y1="17" x2="12" y2="17" />
      </svg>
    ),
  },
  suggeriment: {
    color: "#ca8a04",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.3.3.5.7.5 1.1h6c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3z" />
      </svg>
    ),
  },
};

const STATUS_TONE: Record<SupportStatus, "warn" | "info" | "success"> = {
  open: "warn",
  in_progress: "info",
  resolved: "success",
};

function CategoryChip({ category }: { category: SupportCategory }) {
  const s = CATEGORY_STYLE[category];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ backgroundColor: `${s.color}1a`, color: s.color }}
    >
      {s.icon}
      {SUPPORT_CATEGORY_LABELS[category]}
    </span>
  );
}

/** Selector d'estat en línia. Només el rep l'admin. */
function StatusPicker({
  ticket,
  action,
}: {
  ticket: SupportTicket;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={ticket.id} />
      <select
        name="status"
        // La `key` amb l'estat el fa remuntar quan el servidor en torna un de
        // nou. Sense això, el desplegable és no controlat i es queda amb el
        // valor que tenia al muntar-se: el canvi es desava, però visualment
        // tornava enrere i semblava que no hagués funcionat.
        key={ticket.status}
        defaultValue={ticket.status}
        aria-label={`Estat de "${ticket.title}"`}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-bold text-brand-charcoal focus:border-brand-purple focus:outline-none"
      >
        {SUPPORT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SUPPORT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {state.error && (
        <span className="text-xs text-error">{state.error}</span>
      )}
    </form>
  );
}

export function SupportPanel({
  tickets,
  createAction,
  setStatusAction,
}: {
  tickets: SupportTicket[];
  createAction: Action;
  /** Només l'admin el rep: sense això, l'estat és de només lectura. */
  setStatusAction?: Action;
}) {
  const [state, formAction] = useActionState(createAction, {});
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | SupportStatus>("all");

  const visible =
    filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  // El formulari es tanca sol quan el tiquet s'ha creat. Va a un efecte i no
  // al render perquè és una reacció a l'enviament, no un estat derivat: si es
  // torna a obrir després, `state.ok` segueix sent cert i no l'ha de tancar.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Alta ── */}
      {open ? (
        <form
          action={formAction}
          className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-5"
        >
          <Field
            label="Títol"
            name="title"
            required
            maxLength={150}
            placeholder="Resumeix-ho en una línia"
          />
          <SelectField
            label="Categoria"
            name="category"
            required
            defaultValue="bug"
            options={SUPPORT_CATEGORIES.map((c) => ({
              value: c,
              label: SUPPORT_CATEGORY_LABELS[c],
            }))}
          />
          <TextAreaField
            label="Descripció"
            name="description"
            required
            rows={6}
            maxLength={5000}
            placeholder="Què passa, on ho has vist i què esperaves que passés. Com més concret, més fàcil de resoldre."
          />
          {state.error && <p className="text-sm text-error">{state.error}</p>}
          <div className="flex items-center gap-4">
            <SubmitButton>Enviar</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
            >
              Cancel·lar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            + Nou tiquet
          </button>

          {tickets.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold tracking-wide text-brand-muted uppercase">
                Estat
              </span>
              <select
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as "all" | SupportStatus)
                }
                aria-label="Filtrar per estat"
                className="rounded-lg border border-brand-border bg-white px-2 py-1 font-bold text-brand-charcoal focus:border-brand-purple focus:outline-none"
              >
                <option value="all">Tots</option>
                {SUPPORT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SUPPORT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {state.ok && !open && (
        <p className="text-sm text-success">
          Tiquet enviat. Rebràs resposta per aquí o pel canal de sempre.
        </p>
      )}

      {/* ── Llistat ── */}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
          {tickets.length === 0
            ? "Encara no has obert cap tiquet. Si trobes un error o tens un dubte sobre l'app, explica'l aquí."
            : "Cap tiquet amb aquest estat."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((t) => (
            <li
              key={t.id}
              className="rounded-2xl border border-brand-border bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryChip category={t.category} />
                    <h3 className="text-sm font-bold text-brand-dark">
                      {t.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-brand-charcoal">
                    {t.description}
                  </p>
                  <p className="mt-2 text-xs text-brand-muted">
                    {t.authorName} · {formatDate(t.createdAt)}
                  </p>
                </div>

                <div className="shrink-0">
                  {setStatusAction ? (
                    <StatusPicker ticket={t} action={setStatusAction} />
                  ) : (
                    <Badge tone={STATUS_TONE[t.status]}>
                      {SUPPORT_STATUS_LABELS[t.status]}
                    </Badge>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
