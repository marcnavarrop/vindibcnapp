"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ClientSearch } from "@/components/client-search";
import { BONO_STATUS_LABELS, SERVICE_LABELS, formatEur } from "@/lib/labels";
import { createPaymentAction, paymentBonosAction } from "@/app/(admin)/admin/pagos/actions";
import { searchClientsAction } from "@/app/actions/client-search-actions";
import type { PaymentBono } from "@/lib/data/payments";
import type { BookableClient } from "@/lib/data/slot-booking";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import { TAP } from "@/lib/utils";

/**
 * «+ Nou pagament».
 *
 * El client es BUSCA al servidor (`ClientSearch`, el mateix que la fulla de
 * reserva): abans era un desplegable amb tots els clients del centre, ordenats
 * per alta, i al tall de 1000 files els més nous no hi haurien sortit. Els bons
 * es demanen quan es tria el client, només els seus.
 */
export function PaymentForm() {
  const [state, formAction] = useActionState(createPaymentAction, {} as FormState);
  const [client, setClient] = useState<BookableClient | null>(null);
  const [bonos, setBonos] = useState<PaymentBono[] | null>(null);
  const [bonoId, setBonoId] = useState("");
  const [bonosError, setBonosError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  // Només compta la resposta del darrer client triat: si se'n canvia abans que
  // arribin els bons de l'anterior, aquells es descarten.
  const last = useRef(0);

  function pickClient(c: BookableClient | null) {
    setClient(c);
    setBonos(null);
    setBonoId("");
    setBonosError(null);
    const n = ++last.current;
    if (!c) return;
    paymentBonosAction(c.id)
      .then((r) => {
        if (n !== last.current) return;
        if (r.ok) setBonos(r.bonos);
        else setBonosError(r.error);
      })
      .catch(() => n === last.current && setBonosError("No s'han pogut carregar els bons d'aquest client."));
  }

  function pickBono(id: string) {
    setBonoId(id);
    const b = bonos?.find((x) => x.id === id);
    if (b) setAmount(String(b.price));
  }

  const bonoPlaceholder = !client
    ? "Tria abans un client"
    : bonos === null
      ? bonosError
        ? "No s'han pogut carregar"
        : "Carregant els bons…"
      : bonos.length === 0
        ? "Aquest client no té bons"
        : "Sense bo associat";

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-4 sm:p-6"
    >
      <ClientSearch
        search={searchClientsAction}
        variant="form"
        selected={client}
        onSelect={pickClient}
        emptyHint="Encara no hi ha cap client."
      />

      <div className="flex flex-col gap-1.5">
        <SelectField
          label="Bo (opcional)"
          name="bonoId"
          placeholder={bonoPlaceholder}
          disabled={!bonos || bonos.length === 0}
          value={bonoId}
          onChange={(e) => pickBono(e.target.value)}
          options={(bonos ?? []).map((b) => ({
            value: b.id,
            label: `${SERVICE_LABELS[b.serviceType]} · ${formatEur(b.price)} · ${BONO_STATUS_LABELS[b.status]}`,
          }))}
        />
        {bonosError && (
          <p role="alert" className="text-sm text-error">
            {bonosError}
          </p>
        )}
      </div>

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

      {state.error && (
        <p role="alert" className="text-sm text-error">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Registrar pagament</SubmitButton>
        <Link
          href="/admin/pagos"
          className={`text-sm font-bold text-brand-muted hover:text-brand-purple ${TAP}`}
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
