"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";

/**
 * CONFIRMAR ABANS DEL QUE NO ES POT DESFER, al mateix lloc on s'ha tocat.
 *
 * És el «Sí, cancel·la / No, torna» de l'agenda (`CancelReservationConfirm`)
 * fet peça comuna: el primer toc només pregunta i diu què passarà; el segon fa.
 * Abans hi havia quatre maneres de fer-ho —aquesta, el `window.confirm` del
 * navegador a les ofertes, un «Segur? Sí / No» propi als documents i, a la
 * majoria de llocs, cap— i un toc de més al mòbil s'enduia un anunci, un
 * exercici amb tot el seu progrés o una etiqueta.
 *
 * Quan cal ensenyar un RESUM abans de decidir (un import, un client, un
 * període), el que toca és `ConfirmDialog`, amb les mateixes paraules: «Sí,
 * <verb>» i «No, torna». Aquesta peça és per a les files i les targetes.
 *
 * Dues maneres d'enviar:
 * - Per defecte pinta el seu propi `<form>` amb `fields` com a camps ocults.
 * - Amb `inParentForm`, el «Sí» és un `formAction` dins del formulari que
 *   l'envolta (la nota de sessió: no es pot niar un formulari dins d'un altre,
 *   i els camps ja hi són).
 *
 * El text és de qui la fa servir: l'àrea de client hi passa les traduccions;
 * l'admin i el professional, que van en català fix, es queden amb el defecte.
 */
export function ConfirmInline({
  action,
  fields = {},
  trigger,
  triggerClassName,
  triggerAriaLabel,
  triggerTitle,
  question,
  consequence,
  confirmLabel,
  pendingLabel,
  backLabel = "No, torna",
  groupLabel,
  compact = false,
  pending: pendingProp,
  disabled = false,
  inParentForm = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Camps ocults del formulari propi (`id`, `documentId`…). */
  fields?: Record<string, string>;
  /** El que diu el primer botó («Eliminar», «Treure», «Anul·lar»…). */
  trigger: React.ReactNode;
  /** Sense, el botó del primer toc té el mateix aspecte que el de l'agenda. */
  triggerClassName?: string;
  triggerAriaLabel?: string;
  /** Per què el primer botó està desactivat, si ho està. */
  triggerTitle?: string;
  /** La pregunta, en negreta: «Eliminar aquest anunci?». */
  question: string;
  /** Què passarà, en una frase. Si no hi ha res a explicar, es pot ometre. */
  consequence?: string;
  /** «Sí, elimina». */
  confirmLabel: string;
  /** «Eliminant…». */
  pendingLabel: string;
  backLabel?: string;
  /** Nom del grup per al lector de pantalla. Per defecte, la pregunta. */
  groupLabel?: string;
  /** Fila o targeta: botons petits i el text alineat a la dreta. */
  compact?: boolean;
  /**
   * Estat d'enviament controlat per qui la fa servir (l'agenda en té un de
   * propi, compartit amb «Marcar feta»). Sense, el llegeix del formulari.
   */
  pending?: boolean;
  disabled?: boolean;
  inParentForm?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  const button = compact
    ? `whitespace-nowrap rounded-md border border-brand-border px-2 py-1 text-xs font-bold ${TAP}`
    : `w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-bold ${TAP_SURFACE}`;

  if (!asking && !pendingProp)
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        onClick={() => setAsking(true)}
        className={
          triggerClassName ??
          clsx(button, "text-error hover:bg-error/10 disabled:opacity-60")
        }
      >
        {trigger}
      </button>
    );

  const yes = (
    <YesButton
      className={clsx(
        button,
        "border-error bg-error text-white hover:opacity-90 disabled:opacity-60",
      )}
      label={confirmLabel}
      pendingLabel={pendingLabel}
      pending={pendingProp}
      formAction={inParentForm ? action : undefined}
    />
  );

  return (
    <div
      role="group"
      aria-label={groupLabel ?? question}
      className={clsx("flex flex-col gap-1.5", compact ? "items-end" : "w-full")}
    >
      <p
        className={clsx(
          "text-brand-charcoal",
          compact ? "max-w-[15rem] text-right text-xs" : "text-sm",
        )}
      >
        <span className="font-bold">{question}</span>
        {consequence && <> {consequence}</>}
      </p>
      <div className={clsx("flex gap-1.5", !compact && "w-full")}>
        {inParentForm ? (
          <span className={clsx(!compact && "flex-1")}>{yes}</span>
        ) : (
          <form action={action} className={clsx(!compact && "flex-1")}>
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {yes}
          </form>
        )}
        <BackButton
          className={clsx(
            button,
            !compact && "flex-1",
            "text-brand-muted hover:text-brand-dark disabled:opacity-60",
          )}
          label={backLabel}
          pending={pendingProp}
          onBack={() => setAsking(false)}
        />
      </div>
    </div>
  );
}

/**
 * El «Sí». Viu dins del formulari perquè `useFormStatus` només veu el formulari
 * que l'envolta: així sap si s'està enviant sense que qui la fa servir hagi de
 * portar l'estat.
 */
function YesButton({
  className,
  label,
  pendingLabel,
  pending: pendingProp,
  formAction,
}: {
  className: string;
  label: string;
  pendingLabel: string;
  pending?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * El «No, torna». Fora del formulari del «Sí», així que no veu el seu estat:
 * el rep de qui el controla, si n'hi ha, i si no, es queda actiu (tornar enrere
 * mentre s'envia no fa cap mal: l'acció ja ha sortit).
 */
function BackButton({
  className,
  label,
  pending,
  onBack,
}: {
  className: string;
  label: string;
  pending?: boolean;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onBack}
      className={className}
    >
      {label}
    </button>
  );
}
