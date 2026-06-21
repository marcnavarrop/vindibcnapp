"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export type ClientDefaults = {
  fullName: string;
  email: string;
  phone: string;
  assignedTrainerId: string;
  notes: string;
};

export function ClientForm({
  action,
  trainers,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  trainers: { id: string; name: string }[];
  defaults?: ClientDefaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <Field
        label="Nom complet"
        name="fullName"
        required
        defaultValue={defaults?.fullName}
      />
      <Field
        label="Correu electrònic"
        name="email"
        type="email"
        required
        defaultValue={defaults?.email}
      />
      <Field
        label="Telèfon"
        name="phone"
        type="tel"
        defaultValue={defaults?.phone}
      />
      <SelectField
        label="Entrenador/a assignat/da"
        name="assignedTrainerId"
        placeholder="Sense assignar"
        defaultValue={defaults?.assignedTrainerId}
        options={trainers.map((t) => ({ value: t.id, label: t.name }))}
      />
      <TextAreaField label="Notes" name="notes" defaultValue={defaults?.notes} />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href={cancelHref}
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
