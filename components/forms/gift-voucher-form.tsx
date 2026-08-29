"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { SERVICE_LABELS, formatDate } from "@/lib/labels";
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
        Ara mateix no hi ha cap paquet disponible per regalar.
      </p>
    );

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
        <span className={step === 1 ? "text-brand-purple" : ""}>1. Servei</span>
        <span className="text-brand-border">›</span>
        <span className={step === 2 ? "text-brand-purple" : ""}>2. Paquet</span>
        <span className="text-brand-border">›</span>
        <span>3. Dedicatòria</span>
      </div>

      {step === 1 && (
        <ServiceTypeStep
          services={services}
          palette={palette}
          effectivePrices={effectivePrices}
          intro="Tria el tipus de servei que vols regalar."
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
                Per a qui és? <span className="font-normal text-brand-muted">(opcional)</span>
              </h2>
              <p className="mt-0.5 text-xs text-brand-muted">
                Surt imprès al val. No limita qui el pot bescanviar: qui tingui
                el codi el podrà fer servir.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de qui el rep">
                <input
                  type="text"
                  maxLength={120}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ex.: Laura"
                  className={INPUT}
                />
              </Field>
              <Field label="El seu correu">
                <input
                  type="email"
                  maxLength={160}
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="laura@exemple.com"
                  className={INPUT}
                />
              </Field>
            </div>

            <Field label="Missatge">
              <textarea
                rows={3}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Per molts anys! Gaudeix-ho."
                className={`${INPUT} resize-y`}
              />
            </Field>
          </section>

          {/* ── Pagament ── */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Mètode de pagament
            </span>

            <button
              type="button"
              onClick={() => setConfirming("center")}
              className="flex flex-col items-start rounded-xl border-2 border-brand-purple bg-white px-4 py-3 text-left transition-colors hover:bg-brand-purple/5"
            >
              <span className="font-bold text-brand-dark">Pagar al centre</span>
              <span className="text-xs text-brand-muted">
                Reserva el val ara i paga&apos;l al centre. El podràs regalar de
                seguida; s&apos;activarà quan el centre confirmi el cobrament.
              </span>
            </button>

            {stripeEnabled && (
              <button
                type="button"
                onClick={() => setConfirming("card")}
                className="flex flex-col items-start rounded-xl border-2 border-brand-purple bg-white px-4 py-3 text-left transition-colors hover:bg-brand-purple/5"
              >
                <span className="font-bold text-brand-dark">
                  Pagar amb targeta
                </span>
                <span className="text-xs text-brand-muted">
                  Paga ara en línia i el val queda bescanviable de seguida.
                  T&apos;enviem a la pàgina segura de Stripe.
                </span>
              </button>
            )}
          </div>

          {state.error && <p className="text-sm text-error">{state.error}</p>}
          {checkoutState.error && (
            <p className="text-sm text-error">{checkoutState.error}</p>
          )}

          {selected && (
            <ConfirmDialog
              open={confirming !== null}
              onClose={() => setConfirming(null)}
              title="Confirmes la compra del val?"
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
                    <SubmitButton pendingLabel="Creant el val…" disabled={!acceptsTerms}>
                      Confirmar
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
                    {SERVICE_LABELS[selected.serviceType]} ·{" "}
                    {selected.defaultSessions} sessions
                    {recipientName ? ` · per a ${recipientName}` : ""}
                  </p>
                </div>
                <p className="text-brand-charcoal">
                  {confirming === "card" ? (
                    <>
                      Et portem a la pàgina de pagament de Stripe. El val es
                      genera quan el pagament es confirmi i ja neix{" "}
                      <strong>bescanviable</strong>; si no acabes de pagar, no es
                      crea res.
                    </>
                  ) : (
                    <>
                      En confirmar es genera el val amb el seu codi i el podràs
                      descarregar. <strong>No serà bescanviable</strong> fins que
                      paguis al centre i s&apos;hi confirmi el cobrament.
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
          {alreadyPaid ? "Pagament confirmat" : "El val ja és teu"}
        </p>
        <p className="max-w-sm text-sm text-brand-muted">
          {recipientName
            ? `Ja pots donar-li a ${recipientName}.`
            : "Ja el pots regalar."}{" "}
          {alreadyPaid
            ? "Ja està pagat i és bescanviable des d'ara."
            : "Recorda que s'activarà quan paguis al centre."}
        </p>

        <div className="mt-2 flex flex-col items-center gap-2">
          <span className="text-xs font-bold tracking-widest text-brand-muted uppercase">
            Codi del val
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
              {copied ? "Copiat!" : "Copiar"}
            </button>
          </div>
          <span className="text-xs text-brand-muted">
            {voucher.packageName} · vàlid fins al {formatDate(voucher.expiresAt)}
          </span>
        </div>

        <a
          href={`/client/regals/${voucher.id}/pdf`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
        >
          Descarregar el val
        </a>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-5">
        <div>
          <h2 className="text-sm font-bold text-brand-dark">Enviar-lo per correu</h2>
          <p className="mt-0.5 text-xs text-brand-muted">
            Li arribarà el codi i com fer-lo servir. Si prefereixes donar-l&apos;hi
            en persona, descarrega el val i imprimeix-lo.
          </p>
        </div>

        {sendState.ok ? (
          <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
            Correu enviat.
          </p>
        ) : (
          <form action={sendAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="voucherId" value={voucher.id} />
            <input
              type="email"
              name="email"
              required
              defaultValue={defaultEmail}
              placeholder="correu@exemple.com"
              className={`${INPUT} sm:flex-1`}
            />
            <SubmitButton pendingLabel="Enviant…">Enviar</SubmitButton>
          </form>
        )}

        {sendState.error && (
          <p className="text-sm text-error">{sendState.error}</p>
        )}
      </section>

      <Link
        href="/client/bonos"
        className="self-start text-sm font-bold text-brand-purple hover:text-brand-orange"
      >
        ← Tornar als meus bons
      </Link>
    </div>
  );
}
