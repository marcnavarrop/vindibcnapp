"use client";

import { startTransition, useActionState, useRef } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import { sendCommunityTestAction, type TestSendState } from "@/app/(admin)/admin/community/actions";
import { TAP } from "@/lib/utils";

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
  // L'enviament de prova llegeix el formulari però NO l'envia: si fos un
  // `formAction`, el botó «Publicar» també es posaria a «Publicant…».
  const [test, testAction, testing] = useActionState(sendCommunityTestAction, {} as TestSendState);
  const formRef = useRef<HTMLFormElement>(null);
  const sendTest = () => {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const fd = new FormData(form);
    startTransition(() => testAction(fd));
  };

  return (
    <form
      ref={formRef}
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

      <div className="flex flex-col gap-1.5 rounded-lg bg-brand-bg px-3 py-2.5" data-community-test>
        <button
          type="button"
          onClick={sendTest}
          disabled={testing}
          className={`self-start text-sm font-bold text-brand-purple hover:underline disabled:opacity-60 ${TAP}`}
        >
          {testing ? "Enviant la prova…" : "Enviar-me una prova"}
        </button>
        <p className="text-xs text-brand-muted">
          Et ve a tu el correu tal com el rebrà un client, amb «[Prova]» a l&apos;assumpte. No es publica res ni
          s&apos;envia a ningú més. L&apos;enllaç de baixa és el del Client Demo: el pots provar sense tocar cap compte
          real.
        </p>
        {test.sentTo && (
          <p role="status" className="text-sm font-bold text-success" data-community-test-sent>
            ✓ Prova enviada a {test.sentTo}.
          </p>
        )}
        {test.error && (
          <p role="alert" className="text-sm text-error">
            {test.error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Publicant…">{submitLabel}</SubmitButton>
        <Link
          href="/admin/community"
          className={`text-sm font-bold text-brand-muted hover:text-brand-purple ${TAP}`}
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
