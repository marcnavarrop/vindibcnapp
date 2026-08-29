"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { SERVICE_LABELS } from "@/lib/labels";
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
          Compra realitzada correctament
        </p>
        <p className="max-w-sm text-sm text-brand-muted">
          Paga&apos;l al centre quan vulguis. Ja pots fer servir les sessions
          per reservar mentre estigui pendent de pagament.
        </p>
        <Link
          href="/client/bonos/meus"
          className="mt-2 inline-flex rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
        >
          Veure els meus bonos
        </Link>
      </div>
    );
  }

  // Estat: no hi ha serveis actius
  if (services.length === 0) {
    return (
      <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
        Ara mateix no hi ha cap servei disponible per comprar.
      </p>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {/* ── Indicador de passos ── */}
      <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
        <span className={step === 1 ? "text-brand-purple" : ""}>
          1. Servei
        </span>
        <span className="text-brand-border">›</span>
        <span className={step === 2 ? "text-brand-purple" : ""}>
          2. Paquet
        </span>
        <span className="text-brand-border">›</span>
        <span>3. Pagament</span>
      </div>

      {/* ── Pas 1 ── */}
      {step === 1 && (
        <ServiceTypeStep
          services={services}
          palette={palette}
          effectivePrices={effectivePrices}
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
                {SERVICE_LABELS[selected.serviceType]} ·{" "}
                {selected.defaultSessions} sessions
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
                  {useReferral ? "✓" : "·"} Descompte de referit: {pendingReferralReward.discountPercent}% off
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  {useReferral
                    ? `S'aplica automàticament a aquesta compra (millor descompte disponible).`
                    : `L'oferta del catàleg (${promoDiscountPct.toFixed(0)}%) és millor — el descompte de referit es guardarà per a la propera compra.`}
                </p>
              </div>
            );
          })()}

          {/* Mètode de pagament */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Mètode de pagament
            </span>

            <PaymentMethodOption
              icon={<Building2 className="h-5 w-5" />}
              title="Pagar al centre"
              description={
                <>
                  Reserva el bo ara i paga&apos;l en efectiu al centre per
                  activar-lo.
                </>
              }
              onClick={() => setConfirming("center")}
            />

            {stripeEnabled && (
              <PaymentMethodOption
                icon={<CreditCard className="h-5 w-5" />}
                title="Pagar amb targeta"
                description={
                  <>
                    Paga ara en línia i el bo queda actiu de seguida.
                    T&apos;enviem a la pàgina segura de Stripe.
                  </>
                }
                onClick={() => setConfirming("card")}
              />
            )}
          </div>

          {state.error && (
            <p className="text-sm text-error">{state.error}</p>
          )}
          {checkoutState.error && (
            <p className="text-sm text-error">{checkoutState.error}</p>
          )}

          {selected && (
            <ConfirmDialog
              open={confirming !== null}
              onClose={() => setConfirming(null)}
              title={
                confirming === "card"
                  ? "Confirmes la compra del bo?"
                  : "Confirmes la reserva del bo?"
              }
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
                  >
                    Cancel·lar
                  </button>
                  {confirming === "card" ? (
                    <SubmitButton
                      formAction={checkoutAction}
                      pendingLabel="Anant a Stripe…"
                      disabled={!acceptsTerms}
                    >
                      Pagar amb targeta
                    </SubmitButton>
                  ) : (
                    <SubmitButton
                      pendingLabel="Comprant…"
                      disabled={!acceptsTerms}
                    >
                      Confirmar
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
                    {SERVICE_LABELS[selected.serviceType]} ·{" "}
                    {selected.defaultSessions} sessions
                  </p>
                </div>
                <p className="text-brand-charcoal">
                  {confirming === "card"
                    ? "Et portem a la pàgina de pagament de Stripe. El bo es crea quan el pagament es confirmi; si no acabes de pagar, no es crea res."
                    : "En confirmar, aquest bo ja es podrà fer servir per reservar. El pagues al centre quan vulguis."}
                </p>

                <label className="flex cursor-pointer items-start gap-2.5 text-brand-charcoal">
                  <input
                    type="checkbox"
                    checked={acceptsTerms}
                    onChange={(e) => setAcceptsTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
                  />
                  <span>
                    Accepto les{" "}
                    <Link
                      href="/legal/avis-legal"
                      target="_blank"
                      className="font-bold text-brand-purple underline hover:text-brand-orange"
                    >
                      condicions de compra
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
