"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { clsx, TAP, TAP_SURFACE } from "@/lib/utils";
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
import { announceSupportChange } from "@/lib/support-events";
import type { SupportFormState } from "@/lib/data/support-actions-core";
import type { SupportTicket } from "@/lib/data/support";
import type { SupportCategory, SupportStatus } from "@/types/database";

type Action = (
  prev: SupportFormState,
  fd: FormData,
) => Promise<SupportFormState>;

/**
 * El filtre d'estat té un valor que no és cap estat: `pending`.
 *
 * «Pendent» no és una columna de la base, és la pregunta que es fa qui obre la
 * safata: què queda per tancar. Són els oberts MÉS els que ja s'estan fent.
 * Viu aquí i no a `SUPPORT_STATUSES` perquè no és un estat que un tiquet pugui
 * tenir —ningú no pot moure'l a «pendent»— i al desplegable de cada fila no hi
 * ha de sortir mai.
 */
type StatusFilter = "all" | "pending" | SupportStatus;

const PENDING: SupportStatus[] = ["open", "in_progress"];

function matchesStatus(t: SupportTicket, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "pending") return PENDING.includes(t.status);
  return t.status === f;
}

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

/**
 * La descripció, retallada a tres línies fins que algú demani veure-la sencera.
 *
 * Un tiquet pot tenir 5.000 caràcters i abans es pintaven tots: amb quatre
 * tiquets llargs, la safata era un mur i no es veia ni quants n'hi havia. El
 * «Veure més» només surt si de veritat hi ha text amagat, i això es MESURA
 * (`scrollHeight` contra `clientHeight`) en comptes d'endevinar-ho comptant
 * caràcters: amb un límit de lletres, un text de tres línies curtes oferiria
 * desplegar-se per no ensenyar res.
 */
function Description({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clampable, setClampable] = useState(false);

  useEffect(() => {
    // Desplegat no es mesura: sense el retall el text hi cap sempre, i la
    // conclusió seria que no en sobra gens —s'amagaria el «Veure menys»—.
    if (expanded) return;
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // Mentre el navegador no ha calculat la caixa, l'alçada visible és 0 i
      // QUALSEVOL text sembla retallat. Mesurar un sol cop en muntar-se ho
      // enganxava just en aquest moment i el «Veure més» sortia a totes les
      // files, també a les d'una línia.
      if (el.clientHeight === 0) return;
      setClampable(el.scrollHeight > el.clientHeight + 1);
    };

    measure();

    // I es torna a mesurar cada cop que la caixa canvia de mida: quan acaba
    // de carregar la tipografia i quan es fa estreta la finestra, on un text
    // que hi cabia passa a no cabre-hi.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <>
      <p
        ref={ref}
        className={clsx(
          "mt-2 text-sm whitespace-pre-wrap text-brand-charcoal",
          !expanded && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {clampable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`mt-1 text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP_SURFACE}`}
        >
          {expanded ? "Veure menys" : "Veure més"}
        </button>
      )}
    </>
  );
}

/**
 * Els recomptes per estat, que també filtren.
 *
 * Compten sobre la CATEGORIA triada però ignoren el filtre d'estat: així el
 * número diu sempre quants en sortiran si el toques. Si es descomptessin
 * també per estat, en triar «Oberts» els altres dos marcarien zero i deixarien
 * de servir per moure's.
 *
 * Tornar-hi a clicar treu el filtre. És el gest de sempre d'una fila de
 * pastilles, i sense ell caldria anar a buscar el desplegable per tornar a
 * veure-ho tot.
 */
function StatusCounts({
  counts,
  active,
  onPick,
}: {
  counts: Record<SupportStatus, number>;
  active: StatusFilter;
  onPick: (f: StatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SUPPORT_STATUSES.map((s) => {
        const on = active === s;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? "all" : s)}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-bold",
              TAP,
              on
                ? "border-brand-purple bg-brand-purple text-white"
                : "border-brand-border bg-white text-brand-charcoal hover:border-brand-purple hover:text-brand-purple",
            )}
          >
            {SUPPORT_STATUS_LABELS[s]}{" "}
            <span className={on ? "text-white/70" : "text-brand-muted"}>
              {counts[s]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SupportPanel({
  tickets,
  createAction,
  setStatusAction,
  defaultStatus = "all",
}: {
  tickets: SupportTicket[];
  createAction: Action;
  /** Només l'admin el rep: sense això, l'estat és de només lectura. */
  setStatusAction?: Action;
  /**
   * Amb què s'obre el filtre d'estat.
   *
   * L'admin entra amb `pending`: la seva pantalla és una safata de feina i ha
   * d'ensenyar el que queda per tancar, no un historial encapçalat pel que ja
   * està resolt. El professional es queda amb `all`, que per a ell és el
   * llistat dels seus quatre tiquets i no hi ha res a triar.
   */
  defaultStatus?: StatusFilter;
}) {
  const [state, formAction] = useActionState(createAction, {});
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>(defaultStatus);
  const [category, setCategory] = useState<"all" | SupportCategory>("all");

  const byCategory = useMemo(
    () =>
      category === "all"
        ? tickets
        : tickets.filter((t) => t.category === category),
    [tickets, category],
  );

  const counts = useMemo(() => {
    const c: Record<SupportStatus, number> = {
      open: 0,
      in_progress: 0,
      resolved: 0,
    };
    for (const t of byCategory) c[t.status]++;
    return c;
  }, [byCategory]);

  const visible = useMemo(
    () => byCategory.filter((t) => matchesStatus(t, status)),
    [byCategory, status],
  );

  const filtered = status !== "all" || category !== "all";

  // El formulari es tanca sol quan el tiquet s'ha creat. Va a un efecte i no
  // al render perquè és una reacció a l'enviament, no un estat derivat: si es
  // torna a obrir després, `state.ok` segueix sent cert i no l'ha de tancar.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  // Quants n'hi ha d'oberts, per avisar-ne la piloteta del botó flotant. La
  // dependència és el NÚMERO i no la llista: el servidor torna un array nou a
  // cada `revalidatePath`, i amb l'array l'avís sortiria a cada refresc encara
  // que no hagués canviat res.
  const openCount = useMemo(
    () => tickets.filter((t) => t.status === "open").length,
    [tickets],
  );

  useEffect(() => {
    announceSupportChange(openCount);
  }, [openCount]);

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
              className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
            >
              Cancel·lar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
            >
              + Nou tiquet
            </button>

            {tickets.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-2">
                  <span className="font-bold tracking-wide text-brand-muted uppercase">
                    Estat
                  </span>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as StatusFilter)
                    }
                    aria-label="Filtrar per estat"
                    className="rounded-lg border border-brand-border bg-white px-2 py-1 font-bold text-brand-charcoal focus:border-brand-purple focus:outline-none"
                  >
                    <option value="all">Tots</option>
                    <option value="pending">Pendents</option>
                    {SUPPORT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {SUPPORT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <span className="font-bold tracking-wide text-brand-muted uppercase">
                    Categoria
                  </span>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as "all" | SupportCategory)
                    }
                    aria-label="Filtrar per categoria"
                    className="rounded-lg border border-brand-border bg-white px-2 py-1 font-bold text-brand-charcoal focus:border-brand-purple focus:outline-none"
                  >
                    <option value="all">Totes</option>
                    {SUPPORT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {SUPPORT_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {tickets.length > 0 && (
            <StatusCounts
              counts={counts}
              active={status}
              onPick={setStatus}
            />
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
            : filtered
              ? "Cap tiquet amb aquests filtres."
              : "Cap tiquet."}
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

                  <Description text={t.description} />

                  <p className="mt-2 text-xs text-brand-muted">
                    {t.authorName} · {formatDate(t.createdAt)}
                    {/* Només si s'ha tocat. En néixer, les dues dates són la
                        mateixa —les posa el mateix `now()`— i repetir-la
                        només afegiria soroll a cada fila. Quan hi és, diu
                        quant fa que un tiquet no es mou. */}
                    {t.updatedAt !== t.createdAt && (
                      <> · mogut el {formatDate(t.updatedAt)}</>
                    )}
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
