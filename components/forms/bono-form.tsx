"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatEur, SERVICE_LABELS } from "@/lib/labels";
import { isSubscriptionOnly } from "@/lib/subscription-rules";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { Service } from "@/lib/data/services";
import type { EffectivePrice } from "@/lib/data/promotions";
import { TAP } from "@/lib/utils";

/**
 * L'alta d'un paquet des del taulell, amb DUES cares.
 *
 * El desplegable és un de sol i ensenya el catàleg sencer, però el que hi ha a
 * sota depèn del que es triï:
 *
 *   · Un paquet normal  → sessions, preu i cobrament. L'alta de sempre.
 *   · Un paquet marcat → l'alta d'una SUBSCRIPCIÓ al centre, sense cap camp
 *                         editable: no es ven solt (`lib/subscription-rules.ts`).
 *
 * ELS CAMPS NO S'AMAGUEN AMB CSS, DEIXEN D'EXISTIR. És el mateix criteri que la
 * casella «Sessió de cortesia» al formulari de reserva, i pel mateix motiu: un
 * camp amagat continua enviant-se, i un preu o un nombre de sessions residuals
 * arribarien a una acció que no els espera. Sense camps no hi ha res a ignorar.
 *
 * Els paquets de subscripció NO es treuen del desplegable. Treure'ls faria
 * pensar que el centre no en té; deixar-los i canviar el que surt a sota explica
 * la regla al moment exacte en què importa.
 *
 * DES DE LA 0086 LA CARA DEPÈN DEL PAQUET I NO DEL TIPUS. Dins de 'grupo
 * reduït' hi conviuen les mensualitats (que van per subscripció) i els bons
 * solts com el de 6 sessions (que no), així que triar dos paquets del mateix
 * tipus pot ensenyar dues coses diferents. És el que ha de passar.
 */
export function BonoForm({
  action,
  subscribeAction,
  cancelHref,
  services,
  effectivePrices = {},
  showPayment = true,
  subscriptionsEnabled = false,
  hasLiveSubscription = false,
  renewalDay,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /**
   * L'alta de subscripció al centre, per als paquets marcats. Una acció a part
   * i no un camp del mateix formulari: el que es crea és una altra cosa —una
   * fila a `subscriptions` i el bo del primer mes— i el servidor no ha de
   * desxifrar quina de les dues volia qui ha premut.
   */
  subscribeAction?: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  services: Service[];
  /** Preus efectius (amb descompte) per serviceId. */
  effectivePrices?: Record<string, EffectivePrice>;
  /** Bloque de cobro. Solo el admin registra pagos (RLS); el trainer no. */
  showPayment?: boolean;
  /** El centre admet subscripcions noves. Es torna a mirar al servidor. */
  subscriptionsEnabled?: boolean;
  /** Aquest client ja en té una de viva: no se'n pot obrir una segona. */
  hasLiveSubscription?: boolean;
  /** Dia del mes en què se li renovarà, que és el d'avui al centre. */
  renewalDay?: number;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  // Segona sortida del MATEIX formulari, com a /client/bonos: el botó de la
  // subscripció hi entra amb `formAction` i comparteix el paquet triat sense
  // duplicar cap camp ocult.
  const [subState, subFormAction] = useActionState(
    subscribeAction ?? action,
    {} as FormState,
  );
  const [serviceId, setServiceId] = useState("");
  const [sessions, setSessions] = useState("");
  const [price, setPrice] = useState("");

  const selected = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  const subscriptionOnly = isSubscriptionOnly(selected);
  const canSubscribe =
    subscriptionOnly && !!subscribeAction && subscriptionsEnabled && !hasLiveSubscription;

  function onServiceChange(id: string) {
    setServiceId(id);
    const s = services.find((x) => x.id === id);
    if (s) {
      setSessions(String(s.defaultSessions));
      const ep = effectivePrices[id];
      setPrice(String(ep?.finalPrice ?? s.price));
    }
  }

  const effective = selected
    ? (effectivePrices[selected.id]?.finalPrice ?? selected.price)
    : 0;
  const error = state.error ?? subState.error;

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      {/* El tipus de servei real viatja amagat; el desplegable mostra el catàleg.
          El `serviceId` el posa el propi desplegable, i és l'únic que necessita
          l'alta de subscripció: el preu i les sessions els treu del catàleg el
          servidor, mai d'aquí. */}
      <input type="hidden" name="serviceType" value={selected?.serviceType ?? ""} />

      <SelectField
        label="Paquet"
        name="serviceId"
        placeholder={
          services.length === 0 ? "No hi ha paquets al catàleg" : "Tria un paquet"
        }
        required
        disabled={services.length === 0}
        value={serviceId}
        onChange={(e) => onServiceChange(e.target.value)}
        options={services.map((s) => {
          const ep = effectivePrices[s.id];
          const priceLabel = ep?.hasDiscount
            ? `${formatEur(ep.finalPrice)} (${ep.discountLabel})`
            : formatEur(s.price);
          return {
            value: s.id,
            label: `${SERVICE_LABELS[s.serviceType]} · ${s.name} · ${s.defaultSessions} sess. · ${priceLabel}`,
          };
        })}
      />

      {subscriptionOnly ? (
        <>
          <div className="rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-4 py-3 text-sm">
            <p className="font-bold text-brand-purple">Això és una subscripció</p>
            <p className="mt-1 text-brand-charcoal">
              Els bons de grup no es venen solts. El que es dona d&apos;alta aquí
              és la quota mensual: el client rep {selected?.defaultSessions}{" "}
              sessions ara i unes altres tantes cada mes
              {renewalDay ? `, el dia ${renewalDay}` : ""}, per{" "}
              {formatEur(effective)} al mes amb el preu congelat des d&apos;avui.
            </p>
            <p className="mt-1 text-brand-muted">
              El bo del primer mes neix pendent de pagament, com el de qualsevol
              altre mes: es cobra des de Bons quan el client pagui. Per a la
              subscripció amb targeta, ha d&apos;entrar ell mateix a la seva
              pantalla de bons: el pagament de Stripe demana la seva targeta.
            </p>
          </div>

          {!subscriptionsEnabled && (
            <p className="text-sm text-error">
              Les subscripcions estan desactivades (Configuració → Centre).
              Mentre ho estiguin no se&apos;n pot donar d&apos;alta cap de nova,
              i per tant aquest paquet no es pot vendre. Els paquets que no van
              per subscripció es venen igual.
            </p>
          )}
          {subscriptionsEnabled && hasLiveSubscription && (
            <p className="text-sm text-error">
              Aquest client ja té una subscripció viva. Se&apos;n gestiona des
              de Bons → Subscripcions.
            </p>
          )}
        </>
      ) : (
        <>
          <Field
            label="Nre. de sessions"
            name="totalSessions"
            type="number"
            min={1}
            required
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
          />
          <Field
            label="Preu (€)"
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          {showPayment && (
            <>
              <SelectField
                label="Cobrament"
                name="paymentMethod"
                defaultValue="cash"
                options={[
                  { value: "cash", label: "Efectiu" },
                  { value: "card", label: "Targeta" },
                  { value: "none", label: "No registrar ara" },
                ]}
              />
              <p className="-mt-3 text-xs text-brand-muted">
                Registra el cobrament del bo. Tria «No registrar ara» si encara
                no s&apos;ha pagat.
              </p>
            </>
          )}
        </>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center gap-3">
        {subscriptionOnly ? (
          <SubmitButton
            formAction={subFormAction}
            pendingLabel="Donant d'alta…"
            disabled={!canSubscribe}
          >
            Donar d&apos;alta la subscripció
          </SubmitButton>
        ) : (
          <SubmitButton>Crear bo</SubmitButton>
        )}
        <Link
          href={cancelHref}
          className={`text-sm font-bold text-brand-muted hover:text-brand-purple ${TAP}`}
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
