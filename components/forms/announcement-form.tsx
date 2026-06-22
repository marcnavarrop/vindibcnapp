"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export type AnnouncementDefaults = {
  title: string;
  body: string;
};

export function AnnouncementForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: AnnouncementDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <Field label="Títol" name="title" required defaultValue={defaults?.title} />
      <TextAreaField
        label="Contingut"
        name="body"
        rows={5}
        required
        defaultValue={defaults?.body}
      />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Publicant…">{submitLabel}</SubmitButton>
        <Link
          href="/admin/community"
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
