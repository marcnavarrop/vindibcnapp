"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TAP_SURFACE, clsx } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/labels";
import { RequiredMark } from "@/components/ui/required-mark";
import type { ClientSearchResult } from "@/app/actions/client-search-actions";
import type { BookableClient } from "@/lib/data/slot-booking";
import type { ServiceType } from "@/types/database";

/** El mateix tope que el servidor (`CLIENT_SEARCH_LIMIT`). */
const LIMIT = 20;

/**
 * TRIAR UN CLIENT BUSCANT-LO AL SERVIDOR.
 *
 * Substitueix els desplegables que portaven tots els clients a la pàgina (i en
 * perdien a partir del 1000). S'escriu un tros del nom —sense accents ni
 * majúscules, i en qualsevol ordre— i el servidor en torna com a molt vint, amb
 * els bons. Sense escriure res, surten els primers per ordre alfabètic.
 *
 * Qui pot sortir-hi ho decideix el servidor pel rol de qui mira (vegeu
 * `searchClientsAction`), no aquest component.
 *
 * El triat viatja en un camp amagat (`name`), com el desplegable d'abans.
 */
export function ClientSearch({
  search,
  name = "clientId",
  label = "Client",
  service,
  selected,
  onSelect,
  emptyHint,
  variant = "sheet",
}: {
  search: (query: string) => Promise<ClientSearchResult>;
  /** Nom del camp amagat que s'envia amb el formulari. */
  name?: string;
  label?: string;
  /** Si ja se sap el servei, cada client diu el bo que en gastaria. */
  service?: ServiceType | null;
  selected: BookableClient | null;
  onSelect: (c: BookableClient | null) => void;
  /** Què dir si, sense escriure res, no surt cap client. */
  emptyHint?: string;
  /** L'etiqueta com la de la fulla o com la dels camps del formulari. */
  variant?: "sheet" | "form";
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ClientSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  // Només compta la resposta de l'última cerca: si en tornen dues desordenades,
  // la vella no trepitja la nova.
  const last = useRef(0);

  useEffect(() => {
    const n = ++last.current;
    setLoading(true);
    const t = setTimeout(
      () => {
        search(query)
          .then((r) => n === last.current && setResult(r))
          .catch(
            () => n === last.current && setResult({ ok: false, error: "No s'han pogut buscar els clients." }),
          )
          .finally(() => n === last.current && setLoading(false));
      },
      query ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [query, search]);

  const hint = (c: BookableClient): string => {
    if (service) {
      const b = c.bonos.find((x) => x.serviceType === service);
      return b ? `${SERVICE_LABELS[service]}: ${b.remaining} de ${b.total} sessions` : `sense bo de ${SERVICE_LABELS[service]}`;
    }
    if (c.bonos.length === 0) return "sense bons amb sessions";
    return c.bonos.map((b) => `${SERVICE_LABELS[b.serviceType]} ${b.remaining}/${b.total}`).join(" · ");
  };

  const list = result?.ok ? result.clients : [];

  return (
    <div className={clsx("flex flex-col", variant === "form" ? "gap-1.5" : "gap-2")} data-client-search>
      <label
        htmlFor={`${id}-q`}
        className={
          variant === "form"
            ? "text-sm font-bold tracking-wide text-brand-charcoal uppercase"
            : "text-xs font-bold tracking-wide text-brand-muted uppercase"
        }
      >
        {label}
        {variant === "form" && <RequiredMark />}
      </label>
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      {selected ? (
        <div
          className="flex min-h-11 items-center gap-2 rounded-lg border border-brand-purple bg-brand-purple/5 px-3 py-2"
          data-client-chosen={selected.id}
        >
          <span className="flex-1 text-sm">
            <span className="block font-bold text-brand-dark">{selected.name}</span>
            <span className="block text-xs text-brand-muted">{hint(selected)}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              // Torna al camp, amb el que s'havia escrit.
              setTimeout(() => input.current?.focus(), 0);
            }}
            className={`min-h-11 rounded-lg px-3 text-sm font-bold text-brand-purple hover:bg-brand-bg ${TAP_SURFACE}`}
          >
            Canviar
          </button>
        </div>
      ) : (
        <>
          <input
            ref={input}
            id={`${id}-q`}
            type="search"
            autoComplete="off"
            placeholder="Escriu el nom…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-controls={`${id}-list`}
            className="min-h-11 rounded-lg border border-brand-border bg-white px-3 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
          />
          <div aria-live="polite" className="sr-only">
            {loading ? "Buscant" : `${list.length} clients`}
          </div>
          {result && !result.ok ? (
            <p role="alert" className="text-sm text-error">
              {result.error}
            </p>
          ) : !result ? (
            <p className="text-sm text-brand-muted">Buscant…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-brand-muted" data-client-empty>
              {query.trim() ? `Cap client amb «${query.trim()}».` : (emptyHint ?? "No hi ha cap client.")}
            </p>
          ) : (
            <ul
              id={`${id}-list`}
              aria-label="Clients"
              className={clsx("flex max-h-72 flex-col gap-1 overflow-y-auto", loading && "opacity-60")}
            >
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    data-client-option={c.id}
                    onClick={() => onSelect(c)}
                    className={`flex min-h-11 w-full flex-col items-start rounded-lg border border-brand-border px-3 py-1.5 text-left text-sm hover:bg-brand-bg ${TAP_SURFACE}`}
                  >
                    <span className="font-bold text-brand-dark">{c.name}</span>
                    <span className="text-xs text-brand-muted">{hint(c)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.length >= LIMIT && (
            <p className="text-xs text-brand-muted">
              Surten els {LIMIT} primers. Escriu més lletres del nom per trobar-ne un altre.
            </p>
          )}
        </>
      )}
    </div>
  );
}
