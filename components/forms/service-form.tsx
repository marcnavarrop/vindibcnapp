"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ServiceType } from "@/types/database";
import { TAP } from "@/lib/utils";

const SERVICE_OPTIONS = (Object.keys(SERVICE_LABELS) as ServiceType[]).map(
  (value) => ({ value, label: SERVICE_LABELS[value] }),
);

export type ServiceDefaults = {
  serviceType: ServiceType;
  name: string;
  price: number;
  defaultSessions: number;
  active: boolean;
  subscriptionOnly: boolean;
};

export function ServiceForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: ServiceDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <SelectField
        label="Tipus de servei"
        name="serviceType"
        required
        defaultValue={defaults?.serviceType}
        options={SERVICE_OPTIONS}
      />
      <Field
        label="Nom"
        name="name"
        required
        defaultValue={defaults?.name}
      />
      <Field
        label="Preu (€)"
        name="price"
        type="number"
        min={0}
        step="0.01"
        required
        defaultValue={defaults?.price}
      />
      <Field
        label="Sessions per defecte"
        name="defaultSessions"
        type="number"
        min={1}
        required
        defaultValue={defaults?.defaultSessions ?? 10}
      />
      <label className="flex items-center gap-2 text-sm font-bold text-brand-charcoal">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaults ? defaults.active : true}
          className="h-4 w-4 accent-brand-purple"
        />
        Actiu (disponible per a nous bons)
      </label>

      {/*
        LA CASELLA PORTA SUBTÍTOL, I NO ÉS DECORACIÓ.

        Marcar-la apaga QUATRE camins de compra alhora —el bo pagat al centre,
        el de targeta, l'alta manual des de la fitxa d'un client i el val de
        regal— i n'obre un de sol. Amb només el rètol, qui la marqui ho
        descobriria provant-ho, i probablement des de la queixa d'un client que
        no pot comprar.

        El que NO diu, perquè no és veritat: res sobre l'aforament ni sobre si
        les sessions d'aquest paquet es poden repetir en sèrie. Això va pel
        tipus de servei i no per la casella (vegeu `lib/series-rules.ts`).
      */}
      <label className="flex items-start gap-2 text-sm text-brand-charcoal">
        <input
          type="checkbox"
          name="subscriptionOnly"
          defaultChecked={defaults?.subscriptionOnly ?? false}
          className="mt-0.5 h-4 w-4 accent-brand-purple"
        />
        <span>
          <span className="font-bold">Només per subscripció</span>
          <span className="mt-0.5 block text-xs font-normal text-brand-muted">
            Aquest paquet no es ven solt: ni pagant al centre, ni amb targeta,
            ni donant-lo d&apos;alta a mà des de la fitxa, ni regalant-lo en un
            val. L&apos;única porta és la subscripció mensual.
          </span>
        </span>
      </label>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href="/admin/serveis"
          className={`text-sm font-bold text-brand-muted hover:text-brand-purple ${TAP}`}
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
