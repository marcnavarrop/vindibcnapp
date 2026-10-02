"use client";

import { useActionState } from "react";
import {
  resendInviteAction,
  type ResendState,
} from "@/app/(admin)/admin/invite-actions";
import { TAP } from "@/lib/utils";

/** Botó "Reenviar invitació" per a un usuari (per l'id del seu perfil). */
export function ResendInviteButton({ profileId, inCard = false }: { profileId: string; inCard?: boolean }) {
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
    <form action={formAction} className={inCard ? "relative z-10 flex max-w-[60%] shrink-0 flex-col items-end text-right" : "inline"}>
      <input type="hidden" name="profileId" value={profileId} />
      <button
        type="submit"
        disabled={pending}
        className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple disabled:opacity-50 ${inCard ? "-my-3 inline-flex h-11 items-center" : ""} ${TAP}`}
        title="Reenviar l'email d'invitació per crear la contrasenya"
      >
        {pending ? "Enviant…" : "Reenviar invitació"}
      </button>
      {state.error && (
        <span className={inCard ? "text-xs text-error" : "ml-2 text-xs text-error"}>{state.error}</span>
      )}
    </form>
  );
}
