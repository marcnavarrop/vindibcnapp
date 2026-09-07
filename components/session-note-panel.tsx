"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import {
  saveSessionNoteAction,
  deleteSessionNoteAction,
  type NoteState,
} from "@/app/(trainer)/trainer/reservas/note-actions";
import type { SessionNote } from "@/lib/data/session-notes";

/**
 * La nota d'una sessió, a l'agenda. Català fix: surt a l'àrea de professional i
 * a la d'administració, cap de les dues dins del proveïdor d'idioma. La versió
 * que veu el CLIENT és una altra i sí que va traduïda.
 *
 * `canEdit` no és "sóc professional" sinó "sóc el professional D'AQUESTA
 * sessió". Qui el calcula és la pàgina, i és una llista MÉS ESTRETA que la de
 * `manageableIds`: aquella són les reserves dels meus clients —amb la qual puc
 * marcar "Fet" una sessió que va donar un company— i aquesta només les que vaig
 * donar jo. Confondre-les és tot el que aquesta funció existeix per evitar.
 *
 * Encara que algú les confongui, la nota no es mouria: qui mana és la policy
 * `session_notes_trainer_write`. Això d'aquí és perquè no s'ensenyi un
 * formulari que després diria que no.
 */
export function SessionNotePanel({
  reservationId,
  note,
  canEdit,
}: {
  reservationId: string;
  note: SessionNote | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    saveSessionNoteAction,
    {} as NoteState,
  );

  // Ni nota ni permís per escriure-la: no hi ha res a ensenyar.
  if (!note && !canEdit) return null;

  return (
    <div className="mt-2 border-t border-brand-border pt-2">
      {note && !open && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            Nota de la sessió
          </span>
          <p className="text-sm whitespace-pre-wrap text-brand-charcoal">
            {note.body}
          </p>
          <span className="text-xs text-brand-muted">
            {/* L'autoria s'ensenya SEMPRE. Si la reserva es reassigna, la nota
                passa a mans del professional nou (0079) i sense això semblaria
                seva una nota que no ha escrit. */}
            {note.authorName ?? "Professional donat de baixa"} ·{" "}
            {formatDate(note.updatedAt)}
          </span>
        </div>
      )}

      {!note && !open && canEdit && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
        >
          + Nota de la sessió
        </button>
      )}

      {note && !open && canEdit && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`mt-1 self-start text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
        >
          Editar la nota
        </button>
      )}

      {open && canEdit && (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="reservationId" value={reservationId} />
          <label
            htmlFor={`note-${reservationId}`}
            className="text-xs font-bold tracking-wide text-brand-muted uppercase"
          >
            Nota de la sessió
          </label>
          <textarea
            id={`note-${reservationId}`}
            name="body"
            rows={4}
            defaultValue={note?.body ?? ""}
            className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            placeholder="Com ha anat la sessió, què s'ha treballat, què cal tenir en compte la propera…"
          />
          {/* El text d'ajuda no és decoració: qui escriu ha de saber que el
              client ho llegirà, i que això NO és el lloc de la informació
              clínica —aquella va a les notes del client, que tenen el seu propi
              consentiment i que el client no veu (0035). */}
          <p className="text-xs text-brand-muted">
            Aquesta nota <strong>la llegeix el client</strong>, a més de tu i de
            l&apos;administració. És seguiment de la sessió: si has d&apos;anotar
            informació de salut, va a les notes clíniques de la fitxa del client,
            no aquí.
          </p>
          {state.error && <p className="text-sm text-error">{state.error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton pendingLabel="Desant…">Desar la nota</SubmitButton>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel·lar
            </Button>
            {note && (
              <button
                type="submit"
                formAction={deleteSessionNoteAction}
                className={`text-xs font-bold tracking-wide text-error uppercase hover:underline ${TAP}`}
              >
                Esborrar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
