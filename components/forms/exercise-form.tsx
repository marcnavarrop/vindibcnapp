"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ExerciseCategory } from "@/types/database";

const CATEGORY_OPTIONS = (
  Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[]
).map((value) => ({ value, label: EXERCISE_CATEGORY_LABELS[value] }));

export type ExerciseDefaults = {
  name: string;
  category: ExerciseCategory;
  description: string;
  videoUrl: string;
};

export function ExerciseForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: ExerciseDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <Field label="Nom" name="name" required defaultValue={defaults?.name} />
      <SelectField
        label="Categoria"
        name="category"
        placeholder="Tria una categoria"
        required
        defaultValue={defaults?.category}
        options={CATEGORY_OPTIONS}
      />
      <TextAreaField
        label="Descripció"
        name="description"
        defaultValue={defaults?.description}
      />
      <Field
        label="Enllaç de vídeo (opcional)"
        name="videoUrl"
        type="url"
        placeholder="https://…"
        defaultValue={defaults?.videoUrl}
      />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href="/admin/exercicis"
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
