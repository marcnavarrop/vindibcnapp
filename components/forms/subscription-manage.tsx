"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, CreditCard, Plus } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TAP } from "@/lib/utils";
import { formatEur } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import {
  cancelSubscriptionAction,
  claimExtraAtCenterAction,
  claimExtraByCardAction,
  openBillingPortalAction,
  type ExtraState,
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
  extra,
  stripeEnabled,
}: {
  byCard: boolean;
  cancelAtPeriodEnd: boolean;
  /** L'estat de la quota d'extres del mes. Null = el centre no en permet cap. */
  extra: {
    canClaim: boolean;
    used: number;
    max: number;
    price: number;
    sessionsPerCycle: number;
    renewalDay: number;
  } | null;
  stripeEnabled: boolean;
}) {
  const t = useTranslations("bonos.mine");
  const locale = useLocale() as Locale;
  const [askingExtra, setAskingExtra] = useState(false);
  const [portalState, portalAction] = useActionState(
    openBillingPortalAction,
    {} as SubscriptionActionState,
  );
  const [cancelState, cancelAction] = useActionState(
    cancelSubscriptionAction,
    {} as SubscriptionActionState,
  );
  const [centerState, centerAction] = useActionState(
    claimExtraAtCenterAction,
    {} as ExtraState,
  );
  const [cardState, cardAction] = useActionState(
    claimExtraByCardAction,
    {} as ExtraState,
  );

  return (
    <div className="flex flex-col gap-2 px-5 py-3">
      {extra && extra.max > 0 && (
        <p className="text-sm text-brand-muted">
          {t("subscriptionExtras", { used: extra.used, max: extra.max })}
        </p>
      )}

      {(centerState.ok || cardState.ok) && (
        <p className="text-sm font-bold text-success">{t("subscriptionExtraOk")}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {extra?.canClaim && (
          <button
            type="button"
            onClick={() => setAskingExtra(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-3 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            <Plus className="h-4 w-4" />
            {t("subscriptionExtraCta")}
          </button>
        )}

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
      {centerState.errorCode && (
        <p className="text-sm text-error">{t(centerState.errorCode)}</p>
      )}
      {cardState.errorCode && (
        <p className="text-sm text-error">{t(cardState.errorCode)}</p>
      )}

      {/* El diàleg explica QUÈ costa i per què, abans de crear res. Mateix
          criteri que la compra d'un bo: una sessió que apareix d'un sol clic
          costa d'adonar-se que s'ha adquirit. */}
      {extra && (
        <ConfirmDialog
          ariaClose={t("close")}
          // Es tanca sol quan la sessió ja s'ha afegit. Sense això el diàleg es
          // quedava obert tapant el missatge que diu que ja està fet, i el botó
          // de confirmar convidava a demanar-ne una altra que seria rebutjada.
          open={askingExtra && !centerState.ok && !cardState.ok}
          onClose={() => setAskingExtra(false)}
          title={t("subscriptionExtraTitle")}
          actions={
            <>
              <button
                type="button"
                onClick={() => setAskingExtra(false)}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark active:bg-brand-bg ${TAP}`}
              >
                {t("cancel")}
              </button>
              <form action={centerAction}>
                <SubmitButton pendingLabel={t("subscriptionExtraClaiming")}>
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {t("subscriptionExtraAtCenter")}
                  </span>
                </SubmitButton>
              </form>
              {stripeEnabled && (
                <form action={cardAction}>
                  <SubmitButton pendingLabel={t("subscriptionExtraClaiming")}>
                    <span className="inline-flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4" />
                      {t("subscriptionExtraByCard")}
                    </span>
                  </SubmitButton>
                </form>
              )}
            </>
          }
        >
          <p className="text-sm text-brand-charcoal">
            {t("subscriptionExtraBody", {
              sessions: extra.sessionsPerCycle,
              price: formatEur(extra.price, locale),
              day: extra.renewalDay,
            })}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
