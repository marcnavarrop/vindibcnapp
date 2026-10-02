"use client";

import { COUNTER_METHODS } from "@/lib/counter-payment";
import { clsx } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

/**
 * «Com ha pagat?» dins del diàleg de cobrar: Efectiu o Targeta (TPV).
 *
 * Efectiu ve marcat: és el més habitual al taulell, i així cobrar en efectiu
 * segueix sent els mateixos dos tocs d'abans. La targeta n'afegeix un.
 *
 * Els botons de ràdio porten `form` perquè el diàleg pinta el resum fora del
 * formulari que envia (el «Sí» viu a les accions del diàleg): així el mètode
 * viatja amb el formulari sense haver de moure tot el resum a dins.
 */
export function CounterMethodChoice({
  form,
  value,
  onChange,
}: {
  /** L'`id` del formulari que envia el cobrament. */
  form: string;
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}) {
  return (
    <fieldset className="mt-4 flex flex-col gap-2">
      <legend className="mb-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
        Com ha pagat?
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {COUNTER_METHODS.map((m) => (
          <label
            key={m.value}
            className={clsx(
              "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-2 px-3 text-sm font-bold",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-purple",
              value === m.value
                ? "border-brand-purple bg-brand-purple/10 text-brand-purple"
                : "border-brand-border bg-white text-brand-charcoal hover:border-brand-purple/40",
            )}
          >
            <input
              type="radio"
              name="method"
              form={form}
              value={m.value}
              checked={value === m.value}
              onChange={() => onChange(m.value)}
              className="sr-only"
            />
            {m.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
