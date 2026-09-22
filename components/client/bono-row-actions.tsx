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

  const potPagar = bono.status === "pending_payment" && stripeOn;
  // Si hi ha alguna cosa a dir sobre la renovació: l'interruptor, o el motiu
  // pel qual no n'hi ha. Els bons anteriors a la 0088 no diuen res, i llavors
  // el bloc sencer desapareix en comptes de deixar un buit amb marges.
  const diuAlgunaCosaDeRenovacio = bono.autoRenewBlock !== "noPackage";
  if (!potPagar && !diuAlgunaCosaDeRenovacio) return null;

  return (
    /*
     * `px-5` PERQUÈ ÉS EL MATEIX QUE `Row`
     *
     * Sense ell, la nota i el botó queien enganxats a la vora del panell,
     * vint píxels a l'esquerra del nom del bo a què pertanyen: el botó
     * «Pagar amb targeta» semblava flotar entre dos bons i no es veia de qui
     * era. Amb el mateix sagnat, cau just sota el seu.
     *
     * I SENSE `border-t`
     *
     * N'hi havia un que separava el bo de la seva PRÒPIA nota i el seu propi
     * botó, i empenyia el bloc òpticament cap a la fila de sota. La única
     * ratlla que hi ha d'haver aquí ja la dibuixa el `divide-y` del `Panel`, i
     * va ENTRE bons. El `-mt-1` acaba d'enganxar el bloc a la seva fila.
     */
    <div className="-mt-1 flex flex-col gap-2 px-5 pb-3">
      <AutoRenewToggle bono={bono} />
      {potPagar && (
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

  /*
   * Un bo anterior a la 0088 no ensenya RES: ni interruptor ni explicació.
   *
   * Duia una nota dient que no sabem de quin paquet va sortir, i era veritat
   * però no servia de res: el client no hi pot fer res, no ho ha demanat mai,
   * i repetida a cada bo antic ocupava més que els propis bons. Els altres dos
   * motius sí que s'expliquen, perquè responen una pregunta que el client es
   * pot fer de debò —«i el meu regal?», «i la meva subscripció?»— i surten un
   * cop, no a tota la llista.
   */
  if (bono.autoRenewBlock === "noPackage") return null;

  if (bono.autoRenewBlock)
    return (
      <p className="text-xs text-brand-muted">
        {t(
          bono.autoRenewBlock === "fromGift"
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
