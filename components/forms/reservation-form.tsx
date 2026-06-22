"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS } from "@/lib/labels";
import { createReservationAction } from "@/app/(admin)/admin/reservas/actions";
import type { ReservationFormData } from "@/lib/data/reservations";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export function ReservationForm({
  clients,
  trainers,
}: {
  clients: ReservationFormData["clients"];
  trainers: ReservationFormData["trainers"];
}) {
  const [state, formAction] = useActionState(
    createReservationAction,
    {} as FormState,
  );
  const [clientId, setClientId] = useState("");

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

      <SelectField
        label="Entrenador/a"
        name="trainerId"
        placeholder="Sense assignar"
        options={trainers.map((t) => ({ value: t.id, label: t.name }))}
      />

      <Field label="Data i hora" name="scheduledAt" type="datetime-local" required />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Reservant…">Crear reserva</SubmitButton>
        <Link
          href="/admin/reservas"
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
