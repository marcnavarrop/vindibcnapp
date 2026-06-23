"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS, formatEur } from "@/lib/labels";
import { createPaymentAction } from "@/app/(admin)/admin/pagos/actions";
import type { PaymentFormData } from "@/lib/data/payments";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export function PaymentForm({
  clients,
}: {
  clients: PaymentFormData["clients"];
}) {
  const [state, formAction] = useActionState(
    createPaymentAction,
    {} as FormState,
  );
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");

  const bonos = useMemo(
    () => clients.find((c) => c.id === clientId)?.bonos ?? [],
    [clients, clientId],
  );

  function onBonoChange(id: string) {
    const b = bonos.find((x) => x.id === id);
    if (b) setAmount(String(b.price));
  }

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <SelectField
        label="Client"
        name="clientId"
        placeholder="Tria un client"
        required
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        options={clients.map((c) => ({ value: c.id, label: c.name }))}
      />

      <SelectField
        label="Bo (opcional)"
        name="bonoId"
        placeholder={
          !clientId
            ? "Tria abans un client"
            : bonos.length === 0
              ? "Aquest client no té bons"
              : "Sense bo associat"
        }
        disabled={!clientId || bonos.length === 0}
        onChange={(e) => onBonoChange(e.target.value)}
        options={bonos.map((b) => ({
          value: b.id,
          label: `${SERVICE_LABELS[b.serviceType]} · ${formatEur(b.price)}`,
        }))}
      />

      <Field
        label="Import (€)"
        name="amount"
        type="number"
        min={0}
        step="0.01"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <SelectField
        label="Mètode"
        name="method"
        defaultValue="cash"
        options={[
          { value: "cash", label: "Efectiu" },
          { value: "card", label: "Targeta" },
        ]}
      />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>Registrar pagament</SubmitButton>
        <Link
          href="/admin/pagos"
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
