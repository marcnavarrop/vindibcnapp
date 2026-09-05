"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TAP } from "@/lib/utils";
import {
  cancelSubscriptionAction,
  openBillingPortalAction,
  type SubscriptionActionState,
} from "@/app/(client)/client/bonos/meus/subscription-actions";

/**
 * Els dos botons de la subscripció del client.
 *
 * Cap dels dos envia l'identificador de la subscripció: les accions el busquen
 * a partir de la sessió. Enviar-lo pel formulari seria oferir-lo per provar amb
 * el d'un altre.
 *
 * El de la targeta només surt si es paga amb targeta, i el de baixa desapareix
 * quan ja s'ha demanat: un botó que no farà res val més no ensenyar-lo.
 */
export function SubscriptionManage({
  byCard,
  cancelAtPeriodEnd,
}: {
  byCard: boolean;
  cancelAtPeriodEnd: boolean;
}) {
  const t = useTranslations("bonos.mine");
  const [portalState, portalAction] = useActionState(
    openBillingPortalAction,
    {} as SubscriptionActionState,
  );
  const [cancelState, cancelAction] = useActionState(
    cancelSubscriptionAction,
    {} as SubscriptionActionState,
  );

  return (
    <div className="flex flex-col gap-2 px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {byCard && (
          <form action={portalAction}>
            <SubmitButton pendingLabel={t("subscriptionManageCard")}>
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" />
                {t("subscriptionManageCard")}
              </span>
            </SubmitButton>
          </form>
        )}

        {!cancelAtPeriodEnd && (
          <form action={cancelAction}>
            <button
              type="submit"
              className={`rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-error active:bg-brand-bg ${TAP}`}
            >
              {t("subscriptionCancel")}
            </button>
          </form>
        )}
      </div>

      {portalState.errorCode && (
        <p className="text-sm text-error">{t(portalState.errorCode)}</p>
      )}
      {cancelState.errorCode && (
        <p className="text-sm text-error">{t(cancelState.errorCode)}</p>
      )}
    </div>
  );
}
