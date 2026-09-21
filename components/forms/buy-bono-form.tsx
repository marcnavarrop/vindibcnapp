"use client";

import { TAP } from "@/lib/utils";
import { useActionState, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import type { ColorPalette } from "@/lib/colors";
import {
  createPendingBonoAction,
  startBonoCheckoutAction,
  subscribeAtCenterAction,
  startSubscriptionCheckoutAction,
  type FormState,
  type CheckoutState,
  type SubscribeState,
} from "@/app/(client)/client/bonos/buy-actions";
import type { Service } from "@/lib/data/services";
import type { EffectivePrice } from "@/lib/data/promotions";
import type { PendingReward } from "@/lib/data/referral";
import type { ServiceType } from "@/types/database";
import type { Locale } from "@/lib/i18n/config";
import { PriceDisplay } from "@/components/ui/price-display";
import { ServiceTypeStep, PackageStep } from "@/components/forms/service-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { PaymentMethodOption } from "@/components/forms/payment-method-option";
import { Building2, CreditCard } from "lucide-react";
import { isSubscriptionOnly } from "@/lib/subscription-rules";

// ─── Component principal ──────────────────────────────────────────────────────
export function BuyBonoForm({
  services,
  effectivePrices = {},
  pendingReferralReward = null,
  palette,
  stripeEnabled = false,
  subscriptionsEnabled = false,
  hasLiveSubscription = false,
  subscriptionServiceType = null,
  renewalDay,
}: {
  services: Service[];
  effectivePrices?: Record<string, EffectivePrice>;
  pendingReferralReward?: PendingReward | null;
  /** Colors del centre, ja resolts. */
  palette: ColorPalette;
  /** Es pot pagar amb targeta? Ho decideix el servidor, no el navegador. */
  stripeEnabled?: boolean;
  /** El centre admet subscripcions noves. També es torna a mirar al servidor. */
  subscriptionsEnabled?: boolean;
  /** Ja en té una de viva: no se n'ofereix una segona. */
  hasLiveSubscription?: boolean;
  /**
   * De quin SERVEI és la subscripció viva, si en té cap.
   *
   * No és el mateix que `hasLiveSubscription`, que diu si en té una de
   * qualsevol servei. L'exclusivitat amb la renovació automàtica és per
   * SERVEI: amb subscripció de fisioteràpia es pot renovar sol un bo
   * d'individual, i tenir-ho en compte estalvia amagar una casella que sí que
   * es podia marcar.
   */
  subscriptionServiceType?: ServiceType | null;
  /**
   * Dia del mes en què se li renovaria, que és el d'avui al centre. Arriba del
   * servidor perquè el navegador pot anar en una altra zona horària, i el dia
   * que se li promet ha de ser el que després calcularà l'alta.
   */
  renewalDay: number;
}) {
  const locale = useLocale() as Locale;
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
  // Tercera sortida del mateix formulari, pel mateix motiu que la de targeta:
  // comparteix el paquet triat sense duplicar cap camp.
  const [subscribeState, subscribeAction] = useActionState(
    subscribeAtCenterAction,
    {} as SubscribeState,
  );
  const [subCardState, subCardAction] = useActionState(
    startSubscriptionCheckoutAction,
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
   *
   * Conserva els quatre valors: "center" i "card" ja no s'assoleixen mai amb un
   * paquet de grup, però segueixen essent l'únic camí per a la resta de serveis.
   */
  const [confirming, setConfirming] = useState<null | "center" | "card" | "subscription" | "subscriptionCard">(null);
  /** Condicions acceptades. Es reinicia cada cop que s'obre el diàleg. */
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");

  const selected = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  /**
   * Aquest PAQUET només es pot tenir per subscripció?
   *
   * ES MIRA `selected` I NO EL TIPUS DEL PAS 1, I ÉS EL CANVI DE LA 0086.
   *
   * Abans la resposta es podia donar al pas 1, perquè la regla anava per tipus
   * de servei: triar «grup reduït» ja decidia el rètol i les opcions de
   * pagament, passés el que passés al pas 2. Ara dins d'un mateix tipus hi
   * conviuen els dos règims —les mensualitats de grup van per subscripció, el
   * bo de 6 sessions i la sessió individual es venen solts—, i la pregunta
   * NOMÉS es pot respondre quan hi ha un paquet triat.
   *
   * No hi ha el «instant a resoldre's» que preocupava abans: el pas 1
   * preselecciona el primer paquet del tipus en el mateix gest que canvia de
   * pas, així que quan aquest bloc es pinta `selected` ja hi és. Si per alguna
   * raó no hi fos, `isSubscriptionOnly(undefined)` és false i el client veuria
   * les opcions de compra normals —i el servidor el pararia igualment.
   */
  const subscriptionOnly = isSubscriptionOnly(selected);
  /**
   * ...i se li'n pot obrir una de nova ara mateix?
   *
   * L'interruptor del centre hi entra per completesa: amb les subscripcions
   * apagades, /client/bonos ni tan sols deixa arribar aquests paquets al pas 2,
   * i per tant aquí no s'hi arriba. Es deixa perquè aquesta condició és la que
   * ha de ser certa perquè el botó funcioni, i no la que hagi quedat per
   * eliminació en una altra pantalla.
   */
  const canSubscribe = subscriptionsEnabled && !hasLiveSubscription;
  /*
   * La casella de renovar-lo sol no s'ofereix si ja té subscripció d'AQUEST
   * servei: li arribarien bons per dues vies. El servidor ho retalla igualment
   * (`autoRenewAllowed`), però ensenyar una casella que no farà res seria
   * prometre el que no es compleix.
   */
  const subscriptionCoversThis =
    selected != null && subscriptionServiceType === selected.serviceType;

  // Estat: subscripció activada. Pantalla pròpia i no la del bo: el que s'acaba
  // de fer no és una compra sinó una que es repetirà sola cada mes, i dir-ho
  // ara estalvia la sorpresa del mes que ve.
  if (subscribeState.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-center">
        <AnimatedFeedback type="success" />
        <p className="text-xl font-bold text-success">{t("okSubscriptionTitle")}</p>
        <p className="max-w-sm text-sm text-brand-muted">{t("okSubscriptionBody")}</p>
        <Link
          href="/client/bonos/meus"
          className={`mt-2 inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
        >
          {t("okCta")}
        </Link>
      </div>
    );
  }

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
          className={`mt-2 inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
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
                  locale={locale}
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

          {/*
            Renovar-lo sol quan s'acabi.
            NOMÉS si no és subscripció: aquells ja es renoven cada mes, i la
            constraint `bonos_auto_renew_not_subscription` (0088) ho rebutjaria.
            Va dins del mateix <form>, així que les dues sortides de pagament
            —al centre i amb targeta— la reben sense duplicar res.
          */}
          {!subscriptionOnly && !subscriptionCoversThis && (
            <label className="flex items-start gap-2 rounded-xl border border-brand-border bg-white px-4 py-3 text-sm text-brand-charcoal">
              <input
                type="checkbox"
                name="autoRenew"
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
              />
              <span>
                <span className="font-bold">{t("autoRenewLabel")}</span>
                <span className="block text-xs text-brand-muted">
                  {t("autoRenewHelp")}
                </span>
              </span>
            </label>
          )}

          {/* Mètode de pagament */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              {subscriptionOnly ? t("paySubscribeHow") : t("paymentMethod")}
            </span>

            {/* ── Els paquets marcats: NOMÉS subscripció ──────────────────────
                Les dues opcions de pagament únic no s'amaguen amb una condició
                afegida al final: senzillament no existeixen per a aquest
                paquet. Des de la 0086 això es decideix paquet a paquet, de
                manera que dins d'un mateix servei el client pot veure aquest
                bloc en un i les opcions de compra normals en un altre. I les dues maneres de pagar la subscripció pugen al
                primer nivell, sense la porta intermèdia «Subscriure-m'hi»:
                aquella porta separava dues decisions —pagar avui o
                comprometre's cada mes, i com es paga— i aquí ja no n'hi ha cap
                per prendre. Amb una sola sortida, fer-la prémer dos cops seria
                cerimònia.
                La regla es torna a comprovar al servidor (`quoteBonoPurchase` i
                `quoteSubscription`): aquí es decideix què s'ENSENYA. */}
            {subscriptionOnly ? (
              canSubscribe ? (
                <>
                  <PaymentMethodOption
                    variant="subscription"
                    icon={<Building2 className="h-5 w-5" />}
                    title={t("paySubscribeAtCentre")}
                    description={<>{t("paySubscribeAtCentreDesc")}</>}
                    onClick={() => setConfirming("subscription")}
                  />
                  {stripeEnabled && (
                    <PaymentMethodOption
                      variant="subscription"
                      icon={<CreditCard className="h-5 w-5" />}
                      title={t("paySubscribeByCard")}
                      description={<>{t("paySubscribeByCardDesc")}</>}
                      onClick={() => setConfirming("subscriptionCard")}
                    />
                  )}
                  <p className="mt-1 text-xs text-brand-muted">
                    {t("groupSubscriptionOnly", { day: renewalDay })}
                  </p>
                </>
              ) : (
                /* Sense sortida possible, i abans en quedava una de dolenta: el
                   bo solt. Val més dir per què no hi ha res que deixar tres
                   caixes que menteixen. Només passa si ja en té una de viva
                   —l'índex únic de la 0072 no en deixa una segona—; amb les
                   subscripcions apagades, aquests paquets ni tan sols arriben
                   al pas 2. */
                <div className="rounded-xl border border-brand-border bg-brand-bg px-4 py-3 text-sm">
                  <p className="font-bold text-brand-dark">
                    {t("groupAlreadySubscribedTitle")}
                  </p>
                  <p className="mt-0.5 text-brand-muted">
                    {t("groupAlreadySubscribedBody")}
                  </p>
                  <Link
                    href="/client/bonos/meus"
                    className="mt-2 inline-flex text-sm font-bold text-brand-purple underline hover:text-brand-orange"
                  >
                    {t("groupAlreadySubscribedCta")}
                  </Link>
                </div>
              )
            ) : (
              <>
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
              </>
            )}
          </div>

          {state.errorCode && (
            <p className="text-sm text-error">{t(state.errorCode)}</p>
          )}
          {checkoutState.errorCode && (
            <p className="text-sm text-error">{t(checkoutState.errorCode)}</p>
          )}
          {subscribeState.errorCode && (
            <p className="text-sm text-error">{t(subscribeState.errorCode)}</p>
          )}
          {subCardState.errorCode && (
            <p className="text-sm text-error">{t(subCardState.errorCode)}</p>
          )}

          {selected && (
            <ConfirmDialog
        ariaClose={t("close")}
              open={confirming !== null}
              onClose={() => setConfirming(null)}
              title={
                confirming === "card"
                  ? t("confirmCardTitle")
                  : confirming === "subscription"
                    ? t("confirmSubscriptionTitle")
                    : confirming === "subscriptionCard"
                      ? t("confirmSubscriptionCardTitle")
                      : t("confirmCentreTitle")
              }
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className={`rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark active:bg-brand-bg ${TAP}`}
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
                  ) : confirming === "subscription" ? (
                    <SubmitButton
                      formAction={subscribeAction}
                      pendingLabel={t("subscribing")}
                      disabled={!acceptsTerms}
                    >
                      {t("confirm")}
                    </SubmitButton>
                  ) : confirming === "subscriptionCard" ? (
                    <SubmitButton
                      formAction={subCardAction}
                      pendingLabel={t("goingToStripe")}
                      disabled={!acceptsTerms}
                    >
                      {t("confirm")}
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
                      locale={locale}
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
                    : confirming === "subscription"
                      ? t("confirmSubscriptionBody", { day: renewalDay })
                      : confirming === "subscriptionCard"
                        ? t("confirmSubscriptionCardBody", { day: renewalDay })
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
