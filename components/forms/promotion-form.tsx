"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/labels";
import type { Promotion } from "@/lib/data/promotions";
import type { Service } from "@/lib/data/services";
import type { OfertaFormState } from "@/app/(admin)/admin/ofertes/actions";

export function PromotionForm({
  action,
  cancelHref,
  services,
  initial,
}: {
  action: (prev: OfertaFormState, fd: FormData) => Promise<OfertaFormState>;
  cancelHref: string;
  services: Service[];
  initial?: Promotion;
}) {
  const [state, formAction] = useActionState(action, {});
  const [scope, setScope] = useState<"service" | "package">(
    initial?.scope ?? "service",
  );
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">(
    initial?.discountType ?? "percentage",
  );

  // Calcula l'estat visual (per mostrar badge de solapament)
  const [showOverlap, setShowOverlap] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowOverlap(new URLSearchParams(window.location.search).get("overlap") === "1");
    }
  }, []);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      {showOverlap && (
        <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange">
          Ja hi ha una altra oferta activa que es superposa per a aquest servei/paquet en les mateixes dates. S&apos;ha creat igualment — assegura&apos;t que és la teva intenció.
        </div>
      )}

      <Field
        label="Nom intern"
        name="name"
        required
        placeholder="ex. Descompte d'estiu"
        defaultValue={initial?.name}
      />

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Tipus de descompte"
          name="discountType"
          value={discountType}
          onChange={(e) =>
            setDiscountType(e.target.value as "percentage" | "fixed_amount")
          }
          options={[
            { value: "percentage", label: "Percentatge (%)" },
            { value: "fixed_amount", label: "Import fix (€)" },
          ]}
        />
        <Field
          label={discountType === "percentage" ? "Valor (%)" : "Valor (€)"}
          name="discountValue"
          type="number"
          min={0.01}
          max={discountType === "percentage" ? 100 : undefined}
          step="0.01"
          required
          defaultValue={initial?.discountValue}
        />
      </div>

      <SelectField
        label="Àmbit"
        name="scope"
        value={scope}
        onChange={(e) => setScope(e.target.value as "service" | "package")}
        options={[
          { value: "service", label: "Tot un tipus de servei" },
          { value: "package", label: "Paquet concret" },
        ]}
      />

      {scope === "service" && (
        <SelectField
          label="Tipus de servei"
          name="serviceType"
          required
          defaultValue={initial?.serviceType ?? ""}
          options={SERVICE_TYPES.map((t) => ({
            value: t,
            label: SERVICE_LABELS[t],
          }))}
        />
      )}

      {scope === "package" && (
        <SelectField
          label="Paquet"
          name="serviceId"
          required
          placeholder="Tria un paquet"
          defaultValue={initial?.serviceId ?? ""}
          options={services.map((s) => ({
            value: s.id,
            label: `${SERVICE_LABELS[s.serviceType]} · ${s.name}`,
          }))}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Data d'inici"
          name="startsAt"
          type="date"
          required
          defaultValue={initial?.startsAt}
        />
        <Field
          label="Data de fi"
          name="endsAt"
          type="date"
          required
          defaultValue={initial?.endsAt}
        />
      </div>

      <input
        type="hidden"
        name="active"
        value={initial?.active === false ? "false" : "true"}
      />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>{initial ? "Desar canvis" : "Crear oferta"}</SubmitButton>
        <Link
          href={cancelHref}
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
