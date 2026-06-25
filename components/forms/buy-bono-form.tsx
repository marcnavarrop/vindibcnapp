"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { SelectField } from "@/components/ui/select";
import { formatEur, SERVICE_LABELS } from "@/lib/labels";
import {
  createPendingBonoAction,
  type FormState,
} from "@/app/(client)/client/bonos/comprar/actions";
import type { Service } from "@/lib/data/services";

export function BuyBonoForm({ services }: { services: Service[] }) {
  const [state, formAction] = useActionState(
    createPendingBonoAction,
    {} as FormState,
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const selected = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-8 text-center">
        <p className="text-lg font-bold text-brand-dark">Bo reservat</p>
        <p className="mt-2 text-sm text-brand-muted">
          Paga&apos;l al centre per activar-lo. Mentre estigui pendent de
          pagament no es pot fer servir per reservar.
        </p>
        <Link
          href="/client/bonos"
          className="mt-5 inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
        >
          Veure els meus bonos
        </Link>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
        Ara mateix no hi ha cap servei disponible per comprar.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-6 rounded-2xl border border-brand-border bg-white p-6"
    >
      <input type="hidden" name="serviceId" value={serviceId} />

      {/* a) Servei / paquet */}
      <SelectField
        label="Servei"
        name="serviceSelect"
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
        options={services.map((s) => ({
          value: s.id,
          label: `${s.name} · ${s.defaultSessions} sessions · ${formatEur(s.price)}`,
        }))}
      />

      {selected && (
        <div className="rounded-xl bg-brand-bg p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-bold text-brand-dark">{selected.name}</span>
            <span className="font-bold text-brand-purple">
              {formatEur(selected.price)}
            </span>
          </div>
          <p className="mt-1 text-brand-muted">
            {SERVICE_LABELS[selected.serviceType]} ·{" "}
            {selected.defaultSessions} sessions
          </p>
        </div>
      )}

      {/* b) Mètode de pagament */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
          Mètode de pagament
        </span>

        <button
          type="submit"
          className="flex flex-col items-start rounded-xl border-2 border-brand-purple bg-white px-4 py-3 text-left transition-colors hover:bg-brand-purple/5"
        >
          <span className="font-bold text-brand-dark">Pagar al centre</span>
          <span className="text-xs text-brand-muted">
            Reserva el bo ara i paga&apos;l en efectiu al centre per activar-lo.
          </span>
        </button>

        <div
          aria-disabled
          className="flex cursor-not-allowed flex-col items-start rounded-xl border border-brand-border bg-brand-bg px-4 py-3 text-left opacity-70"
        >
          <span className="flex items-center gap-2 font-bold text-brand-muted">
            Pagar amb targeta
            <span className="rounded-full bg-brand-orange/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-orange uppercase">
              Pròximament
            </span>
          </span>
          <span className="text-xs text-brand-muted">
            El pagament en línia amb targeta encara no està disponible.
          </span>
        </div>
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}
    </form>
  );
}
