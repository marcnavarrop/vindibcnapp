"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { ColorPalette } from "@/lib/colors";
import {
  createPendingBonoAction,
  startBonoCheckoutAction,
  type FormState,
  type CheckoutState,
} from "@/app/(client)/client/bonos/buy-actions";
import type { Service } from "@/lib/data/services";
import type { EffectivePrice } from "@/lib/data/promotions";
import type { PendingReward } from "@/lib/data/referral";
import type { ServiceType } from "@/types/database";
import { PriceDisplay } from "@/components/ui/price-display";
import { ServiceTypeStep, PackageStep } from "@/components/forms/service-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { PaymentMethodOption } from "@/components/forms/payment-method-option";
import { Building2, CreditCard } from "lucide-react";

// ─── Component principal ──────────────────────────────────────────────────────
export function BuyBonoForm({
  services,
  effectivePrices = {},
  pendingReferralReward = null,
  palette,
  stripeEnabled = false,
}: {
  services: Service[];
  effectivePrices?: Record<string, EffectivePrice>;
  pendingReferralReward?: PendingReward | null;
  /** Colors del centre, ja resolts. */
  palette: ColorPalette;
  /** Es pot pagar amb targeta? Ho decideix el servidor, no el navegador. */
  stripeEnabled?: boolean;
}) {
  const t = useTranslations("bonos.buy");
  const tp = useTranslations("picker");
  const tl = useTranslations("labels.service");
  const [state, formAction] = useActionState(
    createPendingBonoAction,
    {} as FormState,
  );
  // Segona sortida del MATEIX formulari: el botó de targeta hi entra amb
  // `formAction`. Així els camps ocults (el paquet triat) es comparteixen i no
  // cal duplicar cap formulari.
  const [checkoutState, checkoutAction] = useActionState(
    startBonoCheckoutAction,
    {} as CheckoutState,
  );

  const [step, setStep] = useState<1 | 2>(1);
  /**
   * Confirmació abans de crear el bo.
   *
   * "Pagar al centre" creava el bo amb un sol clic, i el bo ja serveix per
   * reservar de seguida. Costava adonar-se que s'havia adquirit res: va
   * confondre fins i tot qui coneix l'app. El pas del mig només explica què
   * passarà; la lògica de negoci no canvia.
   */
  const [confirming, setConfirming] = useState<null | "center" | "card">(null);
  /** Condicions acceptades. Es reinicia cada cop que s'obre el diàleg. */
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");

  const selected = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  // Estat: bo creat amb èxit
  if (state.ok) {
    // Mateix tractament que una reserva confirmada: el tic verd animat i el
    // titular en verd. Comprar un bo és tan "fet!" com reservar una sessió i
    // fins ara se'n sortia amb un text pla.
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-center">
        <AnimatedFeedback type="success" />
        <p className="text-xl font-bold text-success">
          {t("okTitle")}
        </p>
        <p className="max-w-sm text-sm text-brand-muted">
          {t("okBody")}
        </p>
        <Link
          href="/client/bonos/meus"
          className="mt-2 inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
        >
          {t("okCta")}
        </Link>
      </div>
    );
  }

  // Estat: no hi ha serveis actius
  if (services.length === 0) {
    return (
      <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
        {t("noServices")}
      </p>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {/* ── Indicador de passos ── */}
      <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
        <span className={step === 1 ? "text-brand-purple" : ""}>
          {t("stepService")}
        </span>
        <span className="text-brand-border">›</span>
        <span className={step === 2 ? "text-brand-purple" : ""}>
          {t("stepPackage")}
        </span>
        <span className="text-brand-border">›</span>
        <span>{t("stepPayment")}</span>
      </div>

      {/* ── Pas 1 ── */}
      {step === 1 && (
        <ServiceTypeStep
          services={services}
          palette={palette}
          effectivePrices={effectivePrices}
          intro={tp("introBono")}
          onSelect={(type) => {
            setServiceType(type);
            // Preselecciona el primer paquet d'aquest tipus
            const first = services.find((s) => s.serviceType === type);
            if (first) setServiceId(first.id);
            setStep(2);
          }}
        />
      )}

      {/* ── Pas 2 + Pagament ── */}
      {step === 2 && serviceType && (
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="serviceId" value={serviceId} />

          <div className="rounded-2xl border border-brand-border bg-white p-5">
            <PackageStep
              services={services}
              palette={palette}
              serviceType={serviceType}
              selectedId={serviceId}
              effectivePrices={effectivePrices}
              onSelect={setServiceId}
              onBack={() => setStep(1)}
            />
          </div>

          {/* Resum del paquet seleccionat */}
          {selected && (
            <div className="rounded-xl bg-brand-bg px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-brand-dark">
                  {selected.name}
                </span>
                <PriceDisplay
                  ep={effectivePrices[selected.id] ?? {
                    originalPrice: selected.price,
                    finalPrice: selected.price,
                    discountAmount: 0,
                    discountLabel: "",
                    hasDiscount: false,
                  }}
                />
              </div>
              <p className="mt-0.5 text-brand-muted">
                {tl(selected.serviceType)} ·{" "}
                {tp("sessions", { count: selected.defaultSessions })}
              </p>
            </div>
          )}

          {/* Banner recompensa de referit */}
          {pendingReferralReward && selected && (() => {
            const ep = effectivePrices[selected.id];
            const promoDiscountPct = ep?.hasDiscount && selected.price > 0
              ? ((selected.price - ep.finalPrice) / selected.price) * 100
              : 0;
            const useReferral = pendingReferralReward.discountPercent > promoDiscountPct;
            return (
              <div className={`rounded-xl border px-4 py-3 text-sm ${useReferral ? "border-brand-purple/30 bg-brand-purple/5" : "border-brand-border bg-brand-bg"}`}>
                <p className={`font-bold ${useReferral ? "text-brand-purple" : "text-brand-muted"}`}>
                  {useReferral ? "✓" : "·"} {t("referralOn", { percent: pendingReferralReward.discountPercent })}
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  {useReferral
                    ? t("referralApplied")
                    : t("referralBetter", { percent: promoDiscountPct.toFixed(0) })}
                </p>
              </div>
            );
          })()}

          {/* Mètode de pagament */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              {t("paymentMethod")}
            </span>

            <PaymentMethodOption
              icon={<Building2 className="h-5 w-5" />}
              title={t("payCentre")}
              description={
                <>
                  {t("payCentreDesc")}
                </>
              }
              onClick={() => setConfirming("center")}
            />

            {stripeEnabled && (
              <PaymentMethodOption
                icon={<CreditCard className="h-5 w-5" />}
                title={t("payCard")}
                description={
                  <>
                    {t("payCardDesc")}
                  </>
                }
                onClick={() => setConfirming("card")}
              />
            )}
          </div>

          {state.errorCode && (
            <p className="text-sm text-error">{t(state.errorCode)}</p>
          )}
          {checkoutState.errorCode && (
            <p className="text-sm text-error">{t(checkoutState.errorCode)}</p>
          )}

          {selected && (
            <ConfirmDialog
        ariaClose={t("close")}
              open={confirming !== null}
              onClose={() => setConfirming(null)}
              title={
                confirming === "card"
                  ? t("confirmCardTitle")
                  : t("confirmCentreTitle")
              }
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
                  >
                    {t("cancel")}
                  </button>
                  {confirming === "card" ? (
                    <SubmitButton
                      formAction={checkoutAction}
                      pendingLabel={t("goingToStripe")}
                      disabled={!acceptsTerms}
                    >
                      {t("payCard")}
                    </SubmitButton>
                  ) : (
                    <SubmitButton
                      pendingLabel={t("buying")}
                      disabled={!acceptsTerms}
                    >
                      {t("confirm")}
                    </SubmitButton>
                  )}
                </>
              }
            >
              <div className="flex flex-col gap-3 text-sm">
                <div className="rounded-xl bg-brand-bg px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-brand-dark">
                      {selected.name}
                    </span>
                    <PriceDisplay
                      ep={
                        effectivePrices[selected.id] ?? {
                          originalPrice: selected.price,
                          finalPrice: selected.price,
                          discountAmount: 0,
                          discountLabel: "",
                          hasDiscount: false,
                        }
                      }
                    />
                  </div>
                  <p className="mt-0.5 text-brand-muted">
                    {tl(selected.serviceType)} ·{" "}
                    {tp("sessions", { count: selected.defaultSessions })}
                  </p>
                </div>
                <p className="text-brand-charcoal">
                  {confirming === "card"
                    ? t("confirmCardBody")
                    : t("confirmCentreBody")}
                </p>

                <label className="flex cursor-pointer items-start gap-2.5 text-brand-charcoal">
                  <input
                    type="checkbox"
                    checked={acceptsTerms}
                    onChange={(e) => setAcceptsTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
                  />
                  <span>
                    {t("accept")}{" "}
                    <Link
                      href="/legal/avis-legal"
                      target="_blank"
                      className="font-bold text-brand-purple underline hover:text-brand-orange"
                    >
                      {t("acceptLink")}
                    </Link>
                    .
                  </span>
                </label>
              </div>
            </ConfirmDialog>
          )}
        </form>
      )}
    </div>
  );
}
