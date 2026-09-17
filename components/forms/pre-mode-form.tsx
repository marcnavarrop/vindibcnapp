"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { setPreModeAction } from "@/lib/actions/pre-mode";

/** Els motius de fallada que pot portar `?pre=` a la URL. */
const ERRORS: Record<string, string> = {
  off: "El mode PRE no estava armat. Arma'l i torna-ho a provar.",
  slug: "Aquell compte no és cap dels tres de demostració. No s'ha saltat.",
  notadmin:
    "Qui ho demana no és l'administrador que va armar el mode PRE. No s'ha saltat.",
  nosession:
    "No s'ha pogut desar el bitllet de tornada, així que no s'ha saltat: " +
    "sortir sense manera de tornar seria pitjor.",
  link: "Supabase no ha pogut obrir la sessió del compte de demostració.",
  mismatch:
    "El compte que ha tornat Supabase no coincideix amb el de la llista blanca. " +
    "El salt s'ha aturat.",
  verify: "El token de sessió no s'ha pogut validar. No s'ha saltat.",
};

/**
 * L'interruptor del mode PRE.
 *
 * El SELECTOR de comptes no és aquí sinó al banner, que es veu a totes les
 * pantalles: aquí hi hauria el mateix botó dues vegades, i el de dalt és el que
 * cal quan ja estàs saltat.
 */
export function PreModeForm({
  armed,
  error,
}: {
  armed: boolean;
  /** Codi que ha arribat per `?pre=`, si el salt anterior va fallar. */
  error?: string;
}) {
  const [state, action] = useActionState(setPreModeAction, {});
  const failure = error ? (ERRORS[error] ?? "El salt no s'ha pogut fer.") : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-bold tracking-wide text-brand-purple uppercase">
          Mode PRE
        </p>
        <p className="mt-0.5 text-xs text-brand-muted">
          Saltar entre els tres comptes de demostració sense tornar a entrar amb
          contrasenya cada vegada.
        </p>
      </div>

      <div className="ml-1 flex flex-col gap-3 border-l-2 border-brand-purple/30 pl-5 text-sm text-brand-dark">
        <p>
          Amb el mode armat surt una barra taronja a dalt de totes les pantalles
          amb els tres comptes:{" "}
          <strong>Entrenador Demo</strong>, <strong>Fisio Demo</strong> i{" "}
          <strong>Client Demo</strong>. Des d&apos;allà mateix es torna a la teva
          sessió.
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-brand-muted">
          <li>
            És d&apos;aquest navegador i teu: l&apos;altre administrador no en
            veurà res.
          </li>
          <li>
            Es desarma sol al cap de <strong>8 hores</strong>, i un salt obert
            caduca en <strong>2 hores</strong>.
          </li>
          <li>
            Només aquests tres comptes. Cap compte real, encara que ho demani un
            administrador.
          </li>
          <li>
            Mentre estigui armat,{" "}
            <strong>l&apos;exportació i la supressió de dades personals
            (RGPD) queden bloquejades</strong>: són la prova de compliment i no
            s&apos;han de fer des d&apos;un mode de proves.
          </li>
          <li>
            Les dades són les de <strong>producció</strong>. Una reserva feta
            com a Client Demo ocupa un forat de veritat a l&apos;agenda.
          </li>
        </ul>
      </div>

      {failure && (
        <p className="rounded-lg border-2 border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
          {failure}
        </p>
      )}
      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="on" value={armed ? "0" : "1"} />
        <SubmitButton
          pendingLabel={armed ? "Apagant…" : "Armant…"}
          variant={armed ? "outline" : "accent"}
        >
          {armed ? "Apagar el mode PRE" : "Armar el mode PRE"}
        </SubmitButton>
        <span className="text-xs text-brand-muted">
          {armed ? "Armat en aquest navegador." : "Apagat."}
        </span>
      </form>
    </div>
  );
}
