"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export function MeasurementForm({
  action,
  cancelHref,
  today,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  today: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <Field
        label="Data"
        name="recordedAt"
        type="date"
        required
        defaultValue={today}
      />
      <Field
        label="Pes (kg)"
        name="weightKg"
        type="number"
        min={0}
        step="0.1"
        placeholder="p. ex. 63.5"
      />
      <TextAreaField label="Notes d'evolució" name="notes" />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>Desar mesura</SubmitButton>
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
