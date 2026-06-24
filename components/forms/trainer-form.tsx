"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { SPECIALTY_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { Specialty } from "@/types/database";

const SPECIALTY_OPTIONS = (
  Object.keys(SPECIALTY_LABELS) as Specialty[]
).map((s) => ({ value: s, label: SPECIALTY_LABELS[s] }));

export type TrainerDefaults = {
  fullName: string;
  email: string;
  specialty: Specialty | null;
};

/**
 * Formulario de entrenador. En modo creación pide nombre, email y especialidad;
 * en modo edición la identidad es fija (solo se cambia la especialidad).
 */
export function TrainerForm({
  action,
  defaults,
  editableIdentity,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: TrainerDefaults;
  editableIdentity: boolean;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      {editableIdentity ? (
        <>
          <Field label="Nom complet" name="fullName" required />
          <Field
            label="Correu electrònic"
            name="email"
            type="email"
            required
          />
        </>
      ) : (
        <div className="rounded-lg border border-brand-border bg-brand-bg p-4">
          <div className="text-lg font-bold text-brand-dark">
            {defaults?.fullName}
          </div>
          <div className="text-sm text-brand-muted">{defaults?.email}</div>
        </div>
      )}

      <SelectField
        label="Especialitat"
        name="specialty"
        placeholder="Tria una especialitat"
        required
        defaultValue={defaults?.specialty ?? ""}
        options={SPECIALTY_OPTIONS}
      />

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
