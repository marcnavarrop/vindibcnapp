"use client";

import { useActionState } from "react";
import {
  resendInviteAction,
  type ResendState,
} from "@/app/(admin)/admin/invite-actions";

/** Botó "Reenviar invitació" per a un usuari (per l'id del seu perfil). */
export function ResendInviteButton({ profileId }: { profileId: string }) {
  const [state, formAction, pending] = useActionState(
    resendInviteAction,
    {} as ResendState,
  );

  if (state.ok)
    return (
      <span className="text-xs font-bold tracking-wide text-success uppercase">
        Enviada ✓
      </span>
    );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="profileId" value={profileId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple disabled:opacity-50"
        title="Reenviar l'email d'invitació per crear la contrasenya"
      >
        {pending ? "Enviant…" : "Reenviar invitació"}
      </button>
      {state.error && (
        <span className="ml-2 text-xs text-error">{state.error}</span>
      )}
    </form>
  );
}
