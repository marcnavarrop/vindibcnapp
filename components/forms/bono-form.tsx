"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ServiceType } from "@/types/database";

const SERVICE_OPTIONS = (Object.keys(SERVICE_LABELS) as ServiceType[]).map(
  (value) => ({ value, label: SERVICE_LABELS[value] }),
);

export function BonoForm({
  action,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <SelectField
        label="Servicio"
        name="serviceType"
        placeholder="Elige un servicio"
        required
        options={SERVICE_OPTIONS}
      />
      <Field
        label="Nº de sesiones"
        name="totalSessions"
        type="number"
        min={1}
        required
        defaultValue={10}
      />
      <Field
        label="Precio (€)"
        name="price"
        type="number"
        min={0}
        step="0.01"
        required
      />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>Crear bono</SubmitButton>
        <Link
          href={cancelHref}
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
