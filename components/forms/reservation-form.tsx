"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS, SERVICE_TYPES, GROUP_CAPACITY } from "@/lib/labels";
import { createReservationAction } from "@/app/(admin)/admin/reservas/actions";
import type { ReservationFormData } from "@/lib/data/reservations";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import { TAP } from "@/lib/utils";

export function ReservationForm({
  clients,
  trainers,
  action = createReservationAction,
  defaultScheduledAt,
}: {
  clients: ReservationFormData["clients"];
  trainers: ReservationFormData["trainers"];
  /** Acción del formulario; por defecto la del área admin. */
  action?: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Valor inicial de data i hora (YYYY-MM-DDTHH:mm), p. ej. desde el calendario. */
  defaultScheduledAt?: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [clientId, setClientId] = useState("");
  // Cortesia: es regala la sessió. El bo deixa de tenir sentit i el tipus de
  // servei, que amb bo sortia del bo, s'ha de dir a mà.
  const [complimentary, setComplimentary] = useState(false);

  const bonos = useMemo(
    () => clients.find((c) => c.id === clientId)?.bonos ?? [],
    [clients, clientId],
  );

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <SelectField
        label="Client"
        name="clientId"
        placeholder="Tria un client"
        required
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        options={clients.map((c) => ({ value: c.id, label: c.name }))}
      />

      {/*
        La casella va ABANS del bo perquè és la que decideix si el bo hi pinta
        res. Marcada, el selector de bo desapareix —no s'amaga amb CSS: deixa
        d'existir, i per tant el formulari no pot enviar un bonoId residual— i
        al seu lloc surt el tipus de servei, que amb bo sortia del bo mateix.
      */}
      <label className="flex items-start gap-2 text-sm text-brand-charcoal">
        <input
          type="checkbox"
          name="complimentary"
          checked={complimentary}
          onChange={(e) => setComplimentary(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
        />
        <span>
          <span className="font-bold">Sessió de cortesia</span>
          <span className="block text-xs text-brand-muted">
            No consumeix cap sessió de bo. En grup ocupa plaça igual: el màxim de{" "}
            {GROUP_CAPACITY} es respecta.
          </span>
        </span>
      </label>

      {complimentary ? (
        <SelectField
          label="Tipus de servei"
          name="serviceType"
          placeholder="Tria un tipus de servei"
          required
          options={SERVICE_TYPES.map((t) => ({
            value: t,
            label: SERVICE_LABELS[t],
          }))}
        />
      ) : (
        <SelectField
          label="Bo (es descomptarà una sessió)"
          name="bonoId"
          placeholder={
            !clientId
              ? "Tria abans un client"
              : bonos.length === 0
                ? "Aquest client no té bons disponibles"
                : "Tria un bo"
          }
          required
          disabled={bonos.length === 0}
          options={bonos.map((b) => ({
            value: b.id,
            label: `${SERVICE_LABELS[b.serviceType]} · ${b.remaining} sessions disponibles`,
          }))}
        />
      )}

      <SelectField
        label="Professional"
        name="trainerId"
        placeholder="Sense assignar"
        options={trainers.map((t) => ({ value: t.id, label: t.name }))}
      />

      <Field
        label="Data i hora"
        name="scheduledAt"
        type="datetime-local"
        required
        defaultValue={defaultScheduledAt}
      />

      <div>
        <Field
          label="Repeticions setmanals"
          name="repeatWeeks"
          type="number"
          min={1}
          max={52}
          defaultValue={1}
        />
        <p className="mt-1 text-xs text-brand-muted">
          Amb més d&apos;1, crea una reserva cada setmana a la mateixa hora
          {complimentary
            ? "."
            : " (consumeix una sessió per reserva)."}
        </p>
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Reservant…">Crear reserva</SubmitButton>
        <Link
          href="/admin/reservas"
          className={`text-sm font-bold text-brand-muted hover:text-brand-purple ${TAP}`}
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
