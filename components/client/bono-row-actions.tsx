"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { TAP } from "@/lib/utils";
import {
  toggleAutoRenewAction,
  payPendingBonoAction,
  type AutoRenewState,
  type PayPendingState,
} from "@/app/(client)/client/bonos/meus-actions";
import type { ClientBono } from "@/lib/data/clients";

/**
 * El que el client pot fer amb un bo seu, sota la seva fila.
 *
 * Dues coses, i cap de les dues hi és sempre: encendre la renovació automàtica
 * (només si el bo la pot dur) i pagar-lo amb targeta (només si està pendent i
 * Stripe està engegat).
 */
export function BonoRowActions({
  bono,
  stripeOn,
}: {
  bono: ClientBono;
  /** Sense claus de Stripe no s'ofereix la targeta, com a la compra. */
  stripeOn: boolean;
}) {
  const t = useTranslations("bonos.mine");

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-brand-border/60 pt-2">
      <AutoRenewToggle bono={bono} />
      {bono.status === "pending_payment" && stripeOn && (
        <PayByCard bonoId={bono.id} label={t("payByCard")} pending={t("payPending")} />
      )}
    </div>
  );
}

/**
 * L'interruptor de renovació automàtica.
 *
 * L'estat es pinta a l'instant i el servidor pot desdir-lo: si el rebutja
 * —perquè el client té subscripció viva d'aquest servei, que és l'única porta
 * que no es pot saber des d'aquí— torna el valor bo i es corregeix sol, amb el
 * motiu escrit a sota. És preferible a bloquejar l'interruptor per una cosa que
 * la pantalla no sap.
 */
function AutoRenewToggle({ bono }: { bono: ClientBono }) {
  const t = useTranslations("bonos.mine");
  const [state, action, pending] = useActionState(
    toggleAutoRenewAction,
    {} as AutoRenewState,
  );
  const [on, setOn] = useState(bono.autoRenew);

  // El servidor mana: si ha dit que no, l'interruptor torna on era.
  useEffect(() => {
    if (typeof state.on === "boolean") setOn(state.on);
  }, [state.on]);

  // Un bo que per la seva naturalesa no es pot renovar no ensenya interruptor:
  // ensenya per què. Un botó apagat que no es pot encendre és pitjor que una
  // frase que ho explica.
  if (bono.autoRenewBlock)
    return (
      <p className="text-xs text-brand-muted">
        {t(
          bono.autoRenewBlock === "noPackage"
            ? "autoRenewNoPackage"
            : bono.autoRenewBlock === "fromGift"
              ? "autoRenewFromGift"
              : "autoRenewFromSubscription",
        )}
      </p>
    );

  const errorKey =
    state.errorCode === "hasSubscription"
      ? "autoRenewHasSubscription"
      : state.errorCode === "notSellable"
        ? "autoRenewNotSellable"
        : state.errorCode
          ? "autoRenewFailed"
          : null;

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="bonoId" value={bono.id} />
      <input type="hidden" name="on" value={String(!on)} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={on}
        className={`flex items-start gap-2 text-left text-xs disabled:opacity-60 ${TAP}`}
      >
        <span
          aria-hidden
          className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors ${
            on ? "bg-brand-purple" : "bg-brand-border"
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full bg-white transition-transform ${
              on ? "translate-x-3" : ""
            }`}
          />
        </span>
        <span>
          <span className="font-bold text-brand-charcoal">
            {t("autoRenewLabel")}
          </span>
          <span className="block text-brand-muted">
            {t(on ? "autoRenewOn" : "autoRenewOff")}
          </span>
        </span>
      </button>
      {errorKey && <p className="text-xs text-error">{t(errorKey)}</p>}
    </form>
  );
}

/** Pagar amb targeta un bo pendent que JA existeix. No en crea cap de nou. */
function PayByCard({
  bonoId,
  label,
  pending: pendingLabel,
}: {
  bonoId: string;
  label: string;
  pending: string;
}) {
  const [state, action, pending] = useActionState(
    payPendingBonoAction,
    {} as PayPendingState,
  );
  const t = useTranslations("bonos.mine");

  return (
    <form action={action}>
      <input type="hidden" name="bonoId" value={bonoId} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 ${TAP}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.errorCode && (
        <p className="mt-1 text-xs text-error">{t("errorStripe")}</p>
      )}
    </form>
  );
}
