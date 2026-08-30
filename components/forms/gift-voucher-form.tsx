"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { formatDate } from "@/lib/labels";
import type { ColorPalette } from "@/lib/colors";
import {
  buyGiftVoucherAction,
  sendGiftVoucherAction,
  startGiftVoucherCheckoutAction,
  type BuyState,
  type SendState,
  type CheckoutState,
} from "@/app/(client)/client/regals/actions";
import { ServiceTypeStep, PackageStep } from "@/components/forms/service-picker";
import type { Service } from "@/lib/data/services";
import type { EffectivePrice } from "@/lib/data/promotions";
import type { ServiceType } from "@/types/database";
import { PriceDisplay } from "@/components/ui/price-display";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { PaymentMethodOption } from "@/components/forms/payment-method-option";
import { Building2, CreditCard } from "lucide-react";

/**
 * Compra d'un val de regal.
 *
 * Els dos primers passos són literalment els mateixos components que la compra
 * d'un bo (`service-picker`): qui ja ha comprat un bo no ha de reaprendre res.
 * El que canvia és el tercer pas —a qui va i què li dius— i el final, que aquí
 * no és "ja pots reservar" sinó un codi per donar.
 */
export function GiftVoucherForm({
  services,
  effectivePrices = {},
  palette,
  stripeEnabled = false,
}: {
  services: Service[];
  effectivePrices?: Record<string, EffectivePrice>;
  palette: ColorPalette;
  /** Es pot pagar amb targeta? Ho decideix el servidor, no el navegador. */
  stripeEnabled?: boolean;
}) {
  const t = useTranslations("gifts");
  const tb = useTranslations("bonos.buy");
  const tp = useTranslations("picker");
  const tl = useTranslations("labels.service");
  const [state, formAction] = useActionState(buyGiftVoucherAction, {} as BuyState);
  // Segona sortida del mateix formulari, com a la compra d'un bo: el botó de
  // targeta hi entra amb `formAction` i comparteix els camps ocults, inclosa
  // la dedicatòria.
  const [checkoutState, checkoutAction] = useActionState(
    startGiftVoucherCheckoutAction,
    {} as CheckoutState,
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [confirming, setConfirming] = useState<null | "center" | "card">(null);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  if (state.ok && state.voucher)
    return (
      <VoucherReady
        voucher={state.voucher}
        defaultEmail={recipientEmail}
        recipientName={recipientName}
      />
    );

  if (services.length === 0)
    return (
      <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
        {t("noPackages")}
      </p>
    );

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
        <span className={step === 1 ? "text-brand-purple" : ""}>{t("stepService")}</span>
        <span className="text-brand-border">›</span>
        <span className={step === 2 ? "text-brand-purple" : ""}>{t("stepPackage")}</span>
        <span className="text-brand-border">›</span>
        <span>{t("stepDedication")}</span>
      </div>

      {step === 1 && (
        <ServiceTypeStep
          services={services}
          palette={palette}
          effectivePrices={effectivePrices}
          intro={tp("introGift")}
          onSelect={(type) => {
            setServiceType(type);
            const first = services.find((s) => s.serviceType === type);
            if (first) setServiceId(first.id);
            setStep(2);
          }}
        />
      )}

      {step === 2 && serviceType && (
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="serviceId" value={serviceId} />
          <input type="hidden" name="recipientName" value={recipientName} />
          <input type="hidden" name="recipientEmail" value={recipientEmail} />
          <input type="hidden" name="message" value={message} />

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

          {/* ── Dedicatòria (opcional) ── */}
          <section className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-5">
            <div>
              <h2 className="text-sm font-bold text-brand-dark">
                {t("forWho")}{" "}
                <span className="font-normal text-brand-muted">{t("optional")}</span>
              </h2>
              <p className="mt-0.5 text-xs text-brand-muted">
                {t("forWhoHint")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("recipientName")}>
                <input
                  type="text"
                  maxLength={120}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={t("recipientNamePlaceholder")}
                  className={INPUT}
                />
              </Field>
              <Field label={t("recipientEmail")}>
                <input
                  type="email"
                  maxLength={160}
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder={t("recipientEmailPlaceholder")}
                  className={INPUT}
                />
              </Field>
            </div>

            <Field label={t("message")}>
              <textarea
                rows={3}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                className={`${INPUT} resize-y`}
              />
            </Field>
          </section>

          {/* ── Pagament ── */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              {tb("paymentMethod")}
            </span>

            <PaymentMethodOption
              icon={<Building2 className="h-5 w-5" />}
              title={tb("payCentre")}
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
                title={tb("payCard")}
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
              open={confirming !== null}
              onClose={() => setConfirming(null)}
              title={t("confirmTitle")}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
                  >
                    {tb("cancel")}
                  </button>
                  {confirming === "card" ? (
                    <SubmitButton
                      formAction={checkoutAction}
                      pendingLabel={tb("goingToStripe")}
                      disabled={!acceptsTerms}
                    >
                      {tb("payCard")}
                    </SubmitButton>
                  ) : (
                    <SubmitButton pendingLabel={t("creating")} disabled={!acceptsTerms}>
                      {tb("confirm")}
                    </SubmitButton>
                  )}
                </>
              }
            >
              <div className="flex flex-col gap-3 text-sm">
                <div className="rounded-xl bg-brand-bg px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-brand-dark">{selected.name}</span>
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
                    {recipientName ? ` · per a ${recipientName}` : ""}
                  </p>
                </div>
                <p className="text-brand-charcoal">
                  {confirming === "card" ? (
                    <>
                      {t("confirmCardBody")}
                    </>
                  ) : (
                    <>
                      {t("confirmCentreBody")}
                    </>
                  )}
                </p>

                <label className="flex cursor-pointer items-start gap-2.5 text-brand-charcoal">
                  <input
                    type="checkbox"
                    checked={acceptsTerms}
                    onChange={(e) => setAcceptsTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
                  />
                  <span>
                    {tb("accept")}{" "}
                    <Link
                      href="/legal/avis-legal"
                      target="_blank"
                      className="font-bold text-brand-purple underline hover:text-brand-orange"
                    >
                      {tb("acceptLink")}
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

const INPUT =
  "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

// ───────────────────────── Pantalla d'èxit ─────────────────────────

export function VoucherReady({
  voucher,
  defaultEmail,
  recipientName,
  /**
   * Ja cobrat? Un val pagat amb targeta neix 'active' i es pot bescanviar de
   * seguida; un de pagat al centre encara no. La pantalla és la mateixa, però
   * dir-li al client que "s'activarà quan paguis" quan ja ha pagat seria fals.
   */
  alreadyPaid = false,
}: {
  voucher: { id: string; code: string; expiresAt: string; packageName: string };
  defaultEmail: string;
  recipientName: string;
  alreadyPaid?: boolean;
}) {
  const t = useTranslations("gifts");
  const [sendState, sendAction] = useActionState(
    sendGiftVoucherAction,
    {} as SendState,
  );
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(voucher.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-border bg-white p-8 text-center">
        <AnimatedFeedback type="success" />
        <p className="text-xl font-bold text-success">
          {alreadyPaid ? t("readyTitlePaid") : t("readyTitle")}
        </p>
        <p className="max-w-sm text-sm text-brand-muted">
          {recipientName
            ? t("readyForName", { name: recipientName })
            : t("readyGeneric")}{" "}
          {alreadyPaid
            ? t("readyPaid")
            : t("readyPending")}
        </p>

        <div className="mt-2 flex flex-col items-center gap-2">
          <span className="text-xs font-bold tracking-widest text-brand-muted uppercase">
            {t("code")}
          </span>
          <div className="flex items-center gap-3">
            <span className="rounded-lg border-2 border-dashed border-brand-purple/40 bg-brand-purple/5 px-4 py-2 font-mono text-lg font-bold tracking-widest text-brand-purple">
              {voucher.code}
            </span>
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-brand-border bg-white px-3 py-2 text-xs font-bold text-brand-dark transition-colors hover:border-brand-purple hover:text-brand-purple"
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <span className="text-xs text-brand-muted">
            {t("validUntil", { package: voucher.packageName, date: formatDate(voucher.expiresAt) })}
          </span>
        </div>

        <a
          href={`/client/regals/${voucher.id}/pdf`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
        >
          {t("download")}
        </a>

        {/*
          El codi no es perd si no el copies ara. Sense dir-ho, aquesta
          pantalla sembla l'única oportunitat de guardar-lo i qui la tanca es
          queda amb la sensació d'haver perdut el que acaba de pagar.
        */}
        <p className="mt-1 text-xs text-brand-muted">
          {t("findAgainPre")}{" "}
          <Link
            href="/client/regals"
            className="font-bold text-brand-purple underline hover:text-brand-orange"
          >
            {t("title")}
          </Link>
          .
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-5">
        <div>
          <h2 className="text-sm font-bold text-brand-dark">{t("sendTitle")}</h2>
          <p className="mt-0.5 text-xs text-brand-muted">
            {t("sendHint")}
          </p>
        </div>

        {sendState.ok ? (
          <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
            {t("sent")}
          </p>
        ) : (
          <form action={sendAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="voucherId" value={voucher.id} />
            <input
              type="email"
              name="email"
              required
              defaultValue={defaultEmail}
              placeholder={t("sendPlaceholder")}
              className={`${INPUT} sm:flex-1`}
            />
            <SubmitButton pendingLabel={t("sending")}>{t("send")}</SubmitButton>
          </form>
        )}

        {sendState.errorCode && (
          <p className="text-sm text-error">{t(sendState.errorCode)}</p>
        )}
      </section>

      <Link
        href="/client/bonos/meus"
        className="self-start text-sm font-bold text-brand-purple hover:text-brand-orange"
      >
        {t("backToBonos")}
      </Link>
    </div>
  );
}
