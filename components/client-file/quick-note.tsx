"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import type { QuickNoteState } from "@/app/(admin)/admin/clients/actions";

/**
 * «Afegir una nota general…» al Resum de la fitxa, només a l'administració.
 * Abans, apuntar una línia volia dir obrir «Editar», el formulari sencer amb
 * nom, telèfon, professional i les notes clíniques, i desar-ho tot.
 *
 * La nota va al final de les generals amb la data i qui l'escriu; les
 * clíniques no es toquen des d'aquí.
 */
export function QuickNoteForm({
  action,
}: {
  action: (prev: QuickNoteState, formData: FormData) => Promise<QuickNoteState>;
}) {
  const [state, formAction] = useActionState(action, {} as QuickNoteState);
  const form = useRef<HTMLFormElement>(null);

  // Desada: el camp es buida. La nota ja surt a dalt, a «Generals».
  useEffect(() => {
    if (state.savedAt) form.current?.reset();
  }, [state.savedAt]);

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-1.5">
      <label htmlFor="quick-note" className="sr-only">
        Afegir una nota general
      </label>
      <div className="flex gap-2">
        <input
          id="quick-note"
          name="note"
          maxLength={500}
          autoComplete="off"
          placeholder="Afegir una nota general…"
          className="h-10 min-w-0 flex-1 rounded-lg border border-brand-border bg-white px-3 text-sm text-brand-dark"
        />
        <SubmitButton pendingLabel="Desant…" className="shrink-0">
          Desar
        </SubmitButton>
      </div>
      <p className="text-xs text-brand-muted">
        S&apos;afegeix al final de les generals amb la data i el teu nom. Res de salut aquí: les
        clíniques, des d&apos;«Editar».
      </p>
      {state.error && (
        <p role="alert" className="text-sm font-bold text-error">
          {state.error}
        </p>
      )}
      {state.savedAt && !state.error && (
        <p role="status" className="text-sm font-bold text-success">
          Nota desada ✓
        </p>
      )}
    </form>
  );
}
