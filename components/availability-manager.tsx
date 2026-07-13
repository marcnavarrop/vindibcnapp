"use client";

import { useState } from "react";
import {
  WEEKDAY_SHORT,
  WEEKDAY_LONG,
  SERVICE_TYPES,
  SERVICE_LABELS,
  defaultServiceTypesFor,
} from "@/lib/labels";
import type { AvailabilityRule } from "@/lib/data/availability";
import type { ServiceType, Specialty } from "@/types/database";

type Action = (formData: FormData) => void | Promise<void>;

/** Grupo de checkboxes de servicios ofrecidos en la franja. */
function ServiceTypesField({
  selected,
  small = false,
}: {
  selected: ServiceType[];
  small?: boolean;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold tracking-wide text-brand-muted uppercase">
        Serveis oferts
      </span>
      <div className="flex flex-wrap gap-2">
        {SERVICE_TYPES.map((s) => (
          <label
            key={s}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-border font-bold text-brand-charcoal has-[:checked]:border-brand-purple has-[:checked]:bg-brand-purple/10 has-[:checked]:text-brand-purple ${
              small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            }`}
          >
            <input
              type="checkbox"
              name="serviceTypes"
              value={s}
              defaultChecked={selected.includes(s)}
            />
            {SERVICE_LABELS[s]}
          </label>
        ))}
      </div>
    </div>
  );
}

export function AvailabilityManager({
  rules,
  todayStr,
  specialty,
  createAction,
  updateAction,
  deleteAction,
}: {
  rules: AvailabilityRule[];
  todayStr: string;
  specialty: Specialty | null;
  createAction: Action;
  updateAction: Action;
  deleteAction: Action;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const byDay = WEEKDAY_LONG.map((label, wd) => ({
    wd,
    label,
    rules: rules.filter((r) => r.weekday === wd),
  })).filter((d) => d.rules.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Alta ágil: varios días + franja + validez */}
      <form
        action={createAction}
        className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6"
      >
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Afegir disponibilitat
        </h2>

        <div>
          <span className="mb-1.5 block text-xs font-bold tracking-wide text-brand-muted uppercase">
            Dies
          </span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_SHORT.map((d, i) => (
              <label
                key={i}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-border px-3 py-1.5 text-sm font-bold text-brand-charcoal has-[:checked]:border-brand-purple has-[:checked]:bg-brand-purple/10 has-[:checked]:text-brand-purple"
              >
                <input type="checkbox" name="weekdays" value={i} />
                {d}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Labeled label="Hora inici">
            <input
              type="time"
              name="startTime"
              step={3600}
              required
              defaultValue="09:00"
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Hora fi">
            <input
              type="time"
              name="endTime"
              step={3600}
              required
              defaultValue="13:00"
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Vàlida des de">
            <input
              type="date"
              name="validFrom"
              required
              defaultValue={todayStr}
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Fins a (opcional)">
            <input type="date" name="validUntil" className={inputCls} />
          </Labeled>
        </div>

        <ServiceTypesField selected={defaultServiceTypesFor(specialty)} />

        <div>
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
          >
            Afegir
          </button>
        </div>
      </form>

      {/* Reglas agrupadas por día */}
      {byDay.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
          Aquest entrenador/a encara no té cap disponibilitat definida. Mentre no
          n&apos;hi hagi cap, els clients no poden reservar amb ell/ella.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {byDay.map((d) => (
            <section
              key={d.wd}
              className="overflow-hidden rounded-2xl border border-brand-border bg-white"
            >
              <h3 className="border-b border-brand-border bg-brand-bg px-5 py-2.5 text-sm font-bold tracking-wide text-brand-dark uppercase">
                {d.label}
              </h3>
              <div className="divide-y divide-brand-border">
                {d.rules.map((r) =>
                  editingId === r.id ? (
                    <form
                      key={r.id}
                      action={updateAction}
                      onSubmit={() => setEditingId(null)}
                      className="flex flex-wrap items-end gap-3 px-5 py-3"
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <Labeled label="Inici">
                        <input
                          type="time"
                          name="startTime"
                          step={3600}
                          required
                          defaultValue={r.startTime}
                          className={inputCls}
                        />
                      </Labeled>
                      <Labeled label="Fi">
                        <input
                          type="time"
                          name="endTime"
                          step={3600}
                          required
                          defaultValue={r.endTime}
                          className={inputCls}
                        />
                      </Labeled>
                      <Labeled label="Des de">
                        <input
                          type="date"
                          name="validFrom"
                          required
                          defaultValue={r.validFrom}
                          className={inputCls}
                        />
                      </Labeled>
                      <Labeled label="Fins a">
                        <input
                          type="date"
                          name="validUntil"
                          defaultValue={r.validUntil ?? ""}
                          className={inputCls}
                        />
                      </Labeled>
                      <div className="w-full">
                        <ServiceTypesField selected={r.serviceTypes} small />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="rounded-md bg-brand-purple px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-purple-light"
                        >
                          Desar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-dark"
                        >
                          Cancel·lar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
                    >
                      <span className="font-bold text-brand-dark">
                        {r.startTime} – {r.endTime}
                      </span>
                      <span className="text-brand-muted">
                        des del {r.validFrom}
                        {r.validUntil ? ` fins al ${r.validUntil}` : " (oberta)"}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {r.serviceTypes.length === 0 ? (
                          <span className="text-xs text-error">
                            sense serveis
                          </span>
                        ) : (
                          r.serviceTypes.map((s) => (
                            <span
                              key={s}
                              className="rounded bg-brand-bg px-1.5 py-0.5 text-xs font-bold text-brand-purple"
                            >
                              {SERVICE_LABELS[s]}
                            </span>
                          ))
                        )}
                      </span>
                      <div className="ml-auto flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingId(r.id)}
                          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                        >
                          Editar
                        </button>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
                          >
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple";

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
