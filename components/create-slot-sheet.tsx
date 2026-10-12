"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";
import { GROUP_CAPACITY, SERVICE_LABELS, formatDate } from "@/lib/labels";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import type { ReservationActionState } from "@/lib/reservation-action-state";
import type { ClientSearchResult } from "@/app/actions/client-search-actions";
import type { BookableClient } from "@/lib/data/slot-booking";
import { ClientSearch } from "@/components/client-search";
import type { ServiceType } from "@/types/database";

type StatefulAction = (
  prev: ReservationActionState,
  formData: FormData,
) => Promise<ReservationActionState>;

const whenFmt = new Intl.DateTimeFormat("ca-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * CREAR UNA RESERVA SOBRE UN FORAT DE LA REJILLA (o apuntar algú a un grup).
 *
 * Fulla al mòbil i plafó a l'escriptori, com la fitxa. No hi ha cap camp de
 * data: el dia i l'hora són els del forat que s'ha tocat.
 *
 *   · Servei: només els que hi caben (`freeServicesAt`, els passa la rejilla).
 *     En un grup amb places, només «Grup» i es va al grup que ja hi ha.
 *   · Client: es BUSCA al servidor (`searchClients`), amb el bo que es gastaria
 *     i les sessions que li queden. Si no en té cap d'aquell servei es diu ABANS
 *     de prémer Crear, i es pot fer igual com a sessió de cortesia… només si el
 *     client és de qui reserva: un client d'un company (`restricted`, 0107) va
 *     sempre amb bo, i la casella ni hi surt.
 *
 * El servidor ho torna a comprovar tot (`createFromSlotAction`): si algú ha
 * agafat el forat mentre la fulla era oberta, l'error surt aquí.
 *
 * `trainer`: per a qui és la reserva quan no és qui mira (viatja amb el
 * formulari). L'admin, el de la columna; el professional, el company del grup
 * on apunta algú (0107).
 */
export function CreateSlotSheet({
  at,
  services,
  group,
  searchClients,
  trainer,
  createAction,
  onClose,
}: {
  at: Date;
  services: ServiceType[];
  /** Apuntar a un grup que ja existeix: quanta gent hi ha. */
  group?: { count: number };
  /** El client es busca al servidor (qui hi surt, ho decideix el rol). */
  searchClients: (query: string) => Promise<ClientSearchResult>;
  /** Per a qui és la reserva, si no és qui mira. */
  trainer?: { id: string; name: string };
  createAction: StatefulAction;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, create, creating] = useActionState(createAction, {});
  const [service, setService] = useState<ServiceType | null>(services[0] ?? null);
  const [courtesy, setCourtesy] = useState(false);
  const [found, setFound] = useState<BookableClient | null>(null);

  const close = useCallback(() => {
    if (state.ok) router.refresh();
    onClose();
  }, [state.ok, router, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const chosen = found;
  const bono = chosen && service ? (chosen.bonos.find((b) => b.serviceType === service) ?? null) : null;
  const noBono = !!chosen && !bono;
  // Un client d'un company, sempre amb bo (0107).
  const courtesyAllowed = !chosen?.restricted;
  const canCreate =
    !!service && !!chosen && (!!bono || (courtesy && courtesyAllowed)) && !creating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-stretch md:justify-end"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={group ? "Apuntar al grup" : "Nova reserva"}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white shadow-xl md:h-full md:max-h-none md:w-[26rem] md:rounded-none"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-brand-border md:hidden" />

        {state.ok ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <AnimatedFeedback type="success" />
            <h2 className="text-xl font-bold text-brand-dark">
              {group ? "Apuntat al grup" : "Reserva creada"}
            </h2>
            <button
              type="button"
              onClick={close}
              className={`mt-2 min-h-11 w-full rounded-lg md:min-h-0 border border-brand-border px-4 py-2.5 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}
            >
              Tancar
            </button>
          </div>
        ) : (
          <form action={create} className="flex flex-col gap-4 p-5 md:p-6">
            <header>
              <h2 className="text-lg font-bold text-brand-dark">
                {group ? "Apuntar al grup" : "Nova reserva"}
              </h2>
              <p className="mt-1 text-sm text-brand-muted first-letter:uppercase">
                {whenFmt.format(at)}
                {group && ` · ${group.count}/${GROUP_CAPACITY}`}
              </p>
              {trainer && (
                <p className="mt-0.5 text-sm font-bold text-brand-charcoal" data-slot-trainer>
                  amb {trainer.name}
                </p>
              )}
            </header>
            <input type="hidden" name="at" value={at.toISOString()} />
            {trainer && <input type="hidden" name="trainerId" value={trainer.id} />}

            {/* Servei: només el que hi cap. */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-bold tracking-wide text-brand-muted uppercase">
                Servei
              </legend>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => (
                  <label
                    key={s}
                    className={clsx(
                      "flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm font-bold",
                      service === s
                        ? "border-brand-purple bg-brand-purple text-white"
                        : "border-brand-border bg-white text-brand-charcoal",
                      TAP,
                    )}
                  >
                    <input
                      type="radio"
                      name="serviceType"
                      value={s}
                      checked={service === s}
                      onChange={() => setService(s)}
                      className="sr-only"
                    />
                    {SERVICE_LABELS[s]}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Client, amb el bo que es gastaria. */}
            <div className="flex flex-col gap-2">
              <ClientSearch
                search={searchClients}
                service={service}
                selected={found}
                onSelect={(c) => {
                  setFound(c);
                  // La cortesia era per al client d'abans: si aquest no és
                  // seu, no n'hi pot haver.
                  if (c?.restricted) setCourtesy(false);
                }}
              />
              {chosen?.restricted && (
                <p className="text-xs text-brand-muted" data-not-yours>
                  No és client teu: només amb bo, de grup o de la teva especialitat a la
                  teva agenda.
                </p>
              )}
              {chosen && service && bono && (
                <p className="text-sm text-brand-charcoal" data-bono-info>
                  Es gastarà <strong>1 sessió</strong> del bo de{" "}
                  {SERVICE_LABELS[service]}: en queden {bono.remaining} de {bono.total}
                  {bono.expiresAt ? `, caduca el ${formatDate(bono.expiresAt)}` : ""}.
                </p>
              )}
              {noBono && service && (
                <p
                  role="status"
                  data-no-bono
                  className="rounded-lg border border-attention/25 bg-attention-bg px-3 py-2 text-sm text-brand-charcoal"
                >
                  <strong>{chosen!.name}</strong> no té cap bo de {SERVICE_LABELS[service]} amb
                  sessions.{" "}
                  {courtesyAllowed
                    ? "Només es pot crear com a sessió de cortesia."
                    : "Com que no és client teu, no s'hi pot fer cap sessió de cortesia."}
                </p>
              )}
            </div>

            {courtesyAllowed && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="courtesy"
                checked={courtesy}
                onChange={(e) => setCourtesy(e.target.checked)}
                className="h-4 w-4 accent-brand-purple"
              />
              <span>
                Sessió de cortesia <span className="text-brand-muted">(no descompta cap sessió)</span>
              </span>
            </label>
            )}

            {state.error && (
              <p role="alert" className="text-sm text-error">
                {state.error}
              </p>
            )}

            {/* «Crear» i «Tancar», de 44 px al mòbil com la resta de botons que es
                toquen amb el dit; a l'ordinador, la mida de sempre. */}
            <button
              type="submit"
              disabled={!canCreate}
              className={`min-h-11 w-full rounded-lg bg-brand-purple md:min-h-0 px-3 py-2.5 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-50 ${TAP_SURFACE}`}
            >
              {creating ? "Creant…" : group ? "Apuntar-hi" : "Crear"}
            </button>
            <button
              type="button"
              onClick={close}
              className={`min-h-11 w-full rounded-lg px-3 py-2 text-sm md:min-h-0 font-bold text-brand-muted hover:text-brand-dark ${TAP_SURFACE}`}
            >
              Tancar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
