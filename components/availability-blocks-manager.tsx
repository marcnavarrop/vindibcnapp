"use client";

import { useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS } from "@/lib/labels";
import type { AvailabilityBlock } from "@/lib/data/availability-blocks";
import type { BlockFormState } from "@/lib/data/availability-block-submit";
import type { ServiceType } from "@/types/database";
import { TAP } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:MM" per als inputs datetime-local, en hora local. */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const date = new Intl.DateTimeFormat("ca-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = new Intl.DateTimeFormat("ca-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${date.format(s)}, ${time.format(s)}–${time.format(e)}`
    : `${date.format(s)} ${time.format(s)} → ${date.format(e)} ${time.format(e)}`;
}

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AvailabilityBlocksManager({
  blocks,
  createAction,
  deleteAction,
  openingHour,
  closingHour,
}: {
  blocks: AvailabilityBlock[];
  /** Horari del centre (configurable per l'admin). */
  openingHour: number;
  closingHour: number;
  createAction: (
    prev: BlockFormState,
    formData: FormData,
  ) => Promise<BlockFormState>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [state, action] = useActionState(createAction, {});
  const [allDay, setAllDay] = useState(true);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(openingHour, 0, 0, 0);
    return d;
  }, [openingHour]);

  // Amb "Dia complet" es demanen només dates i el servidor hi posa l'horari
  // del centre; si no, es demanen data i hora exactes.
  const [startDay, setStartDay] = useState(() => toLocalInput(today).slice(0, 10));
  const [endDay, setEndDay] = useState(() => toLocalInput(today).slice(0, 10));
  const [startAt, setStartAt] = useState(() => toLocalInput(today));
  const [endAt, setEndAt] = useState(() => {
    const d = new Date(today);
    d.setHours(closingHour, 0, 0, 0);
    return toLocalInput(d);
  });

  const nowMs = Date.now();
  const affected = state.pending?.affected ?? [];

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-lg font-bold text-brand-dark">
        Bloquejos temporals
      </h2>
      <p className="mb-4 text-sm text-brand-muted">
        Vacances, baixes o una tarda puntual. Se superposen a l&apos;horari
        setmanal: durant un bloqueig no es pot reservar, encara que hi hagi
        horari definit.
      </p>

      {/* ── Llistat ── */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-brand-border bg-white">
        {blocks.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-brand-muted">
            No hi ha cap bloqueig actiu ni previst.
          </p>
        ) : (
          <ul className="divide-y divide-brand-border">
            {blocks.map((b) => {
              const started = new Date(b.startAt).getTime() <= nowMs;
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-brand-dark">
                      {fmtRange(b.startAt, b.endAt)}
                      {started && (
                        <span className="ml-2 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[10px] font-bold text-brand-orange uppercase">
                          En curs
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-brand-muted">
                      {b.reason?.trim() || "Sense motiu especificat"}
                    </p>
                  </div>
                  {started ? (
                    <span
                      className="text-xs text-brand-muted italic"
                      title="Un bloqueig que ja ha començat no es pot eliminar"
                    >
                      Ja iniciat
                    </span>
                  ) : (
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button
                        type="submit"
                        className={`text-xs font-bold tracking-wide text-error uppercase hover:underline ${TAP}`}
                      >
                        Eliminar
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Alta ── */}
      <form
        action={action}
        className="rounded-2xl border border-brand-border bg-white p-6"
      >
        <p className="mb-4 text-sm font-bold text-brand-dark">Nou bloqueig</p>

        <label className="mb-4 flex items-center gap-2 text-sm text-brand-charcoal">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 accent-brand-purple"
          />
          Dia complet
          <span className="text-xs text-brand-muted">
            (de {pad(openingHour)}:00 a {pad(closingHour)}:00)
          </span>
        </label>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          {allDay ? (
            <>
              <div>
                <label
                  htmlFor="startDay"
                  className="mb-1 block text-xs font-bold tracking-wide text-brand-muted uppercase"
                >
                  Del dia
                </label>
                <input
                  id="startDay"
                  name="startDay"
                  type="date"
                  required
                  value={startDay}
                  onChange={(e) => setStartDay(e.target.value)}
                  className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="endDay"
                  className="mb-1 block text-xs font-bold tracking-wide text-brand-muted uppercase"
                >
                  Fins al dia (inclòs)
                </label>
                <input
                  id="endDay"
                  name="endDay"
                  type="date"
                  required
                  value={endDay}
                  onChange={(e) => setEndDay(e.target.value)}
                  className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label
                  htmlFor="startAt"
                  className="mb-1 block text-xs font-bold tracking-wide text-brand-muted uppercase"
                >
                  Inici
                </label>
                <input
                  id="startAt"
                  name="startAt"
                  type="datetime-local"
                  required
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="endAt"
                  className="mb-1 block text-xs font-bold tracking-wide text-brand-muted uppercase"
                >
                  Fi
                </label>
                <input
                  id="endAt"
                  name="endAt"
                  type="datetime-local"
                  required
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="mb-4">
          <label
            htmlFor="reason"
            className="mb-1 block text-xs font-bold tracking-wide text-brand-muted uppercase"
          >
            Motiu (opcional)
          </label>
          <input
            id="reason"
            name="reason"
            type="text"
            placeholder="Ex: Vacances, Baixa mèdica"
            defaultValue={state.pending?.reason ?? ""}
            className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
          />
        </div>

        {/* ── Reserves afectades: confirmació explícita ── */}
        {state.pending && (
          <div className="mb-4 rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4">
            <p className="text-sm font-bold text-brand-dark">
              {affected.length === 1
                ? "Hi ha 1 reserva dins d'aquest bloqueig"
                : `Hi ha ${affected.length} reserves dins d'aquest bloqueig`}
            </p>
            <p className="mt-1 mb-3 text-xs text-brand-muted">
              El bloqueig es crearà igualment. Marca les que vulguis cancel·lar
              ara: es retornarà la sessió al bo i s&apos;avisarà el client per
              correu. Les que no marquis es mantindran reservades.
            </p>

            {/* Es reenvien perquè la confirmació no depengui dels camps de dalt. */}
            <input type="hidden" name="confirmStartAt" value={state.pending.startAt} />
            <input type="hidden" name="confirmEndAt" value={state.pending.endAt} />

            <ul className="mb-3 space-y-2">
              {affected.map((r) => (
                <li key={r.id}>
                  <label className="flex items-start gap-2 text-sm text-brand-charcoal">
                    <input
                      type="checkbox"
                      name="cancelIds"
                      value={r.id}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
                    />
                    <span>
                      <span className="font-bold text-brand-dark">
                        {r.clientName}
                      </span>{" "}
                      · {fmtWhen(r.scheduledAt)} ·{" "}
                      {SERVICE_LABELS[r.serviceType as ServiceType] ??
                        r.serviceType}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.error && <p className="mb-3 text-sm text-error">{state.error}</p>}
        {state.ok && (
          <p className="mb-3 text-sm text-success">Bloqueig creat.</p>
        )}

        <SubmitButton>
          {state.pending ? "Confirmar bloqueig" : "Crear bloqueig"}
        </SubmitButton>
      </form>
    </section>
  );
}
