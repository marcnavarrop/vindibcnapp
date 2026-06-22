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

export type ServiceDefaults = {
  serviceType: ServiceType;
  name: string;
  price: number;
  defaultSessions: number;
  active: boolean;
};

export function ServiceForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: ServiceDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <SelectField
        label="Tipus de servei"
        name="serviceType"
        required
        defaultValue={defaults?.serviceType}
        options={SERVICE_OPTIONS}
      />
      <Field
        label="Nom"
        name="name"
        required
        defaultValue={defaults?.name}
      />
      <Field
        label="Preu (€)"
        name="price"
        type="number"
        min={0}
        step="0.01"
        required
        defaultValue={defaults?.price}
      />
      <Field
        label="Sessions per defecte"
        name="defaultSessions"
        type="number"
        min={1}
        required
        defaultValue={defaults?.defaultSessions ?? 10}
      />
      <label className="flex items-center gap-2 text-sm font-bold text-brand-charcoal">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaults ? defaults.active : true}
          className="h-4 w-4 accent-brand-purple"
        />
        Actiu (disponible per a nous bons)
      </label>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href="/admin/serveis"
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
