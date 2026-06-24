"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatEur } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { Service } from "@/lib/data/services";

export function BonoForm({
  action,
  cancelHref,
  services,
  showPayment = true,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  services: Service[];
  /** Bloque de cobro. Solo el admin registra pagos (RLS); el trainer no. */
  showPayment?: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [serviceId, setServiceId] = useState("");
  const [sessions, setSessions] = useState("");
  const [price, setPrice] = useState("");

  const selected = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  function onServiceChange(id: string) {
    setServiceId(id);
    const s = services.find((x) => x.id === id);
    if (s) {
      setSessions(String(s.defaultSessions));
      setPrice(String(s.price));
    }
  }

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      {/* El tipus de servei real viatja amagat; el desplegable mostra el catàleg. */}
      <input type="hidden" name="serviceType" value={selected?.serviceType ?? ""} />

      <SelectField
        label="Servei"
        name="serviceId"
        placeholder={
          services.length === 0 ? "No hi ha serveis al catàleg" : "Tria un servei"
        }
        required
        disabled={services.length === 0}
        value={serviceId}
        onChange={(e) => onServiceChange(e.target.value)}
        options={services.map((s) => ({
          value: s.id,
          label: `${s.name} · ${formatEur(s.price)}`,
        }))}
      />
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
            Registra el cobrament del bo. Tria «No registrar ara» si encara no
            s&apos;ha pagat.
          </p>
        </>
      )}

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>Crear bo</SubmitButton>
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
