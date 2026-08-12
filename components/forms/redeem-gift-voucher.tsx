"use client";

import { useActionState } from "react";
import {
  redeemGiftVoucherAction,
  type RedeemState,
} from "@/app/(client)/client/bonos/redeem-actions";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * "Tens un codi de regal?"
 *
 * Un sol camp i un botó. Els errors es diuen sencers i sense eufemismes: qui
 * bescanvia sovint no és client del centre i, si el val encara no s'ha cobrat,
 * no ha fet res malament — necessita saber a qui reclamar, no un "codi no
 * vàlid" que el deixi pensant que s'ha equivocat en teclejar.
 */
export function RedeemGiftVoucher() {
  const [state, action] = useActionState(
    redeemGiftVoucherAction,
    {} as RedeemState,
  );

  if (state.ok)
    return (
      <section className="flex flex-col items-center gap-2 rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
        <AnimatedFeedback type="success" />
        <p className="font-bold text-success">Regal activat!</p>
        <p className="text-sm text-brand-charcoal">
          {state.detail} ja són al teu compte.
        </p>
      </section>
    );

  return (
    <section className="rounded-2xl border border-brand-border bg-white p-5">
      <h2 className="text-sm font-bold text-brand-dark">Tens un codi de regal?</h2>
      <p className="mt-0.5 mb-3 text-xs text-brand-muted">
        Escriu-lo aquí i les sessions s&apos;afegiran al teu compte.
      </p>

      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          name="code"
          required
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
          placeholder="VINDI-XXXX-XXXX"
          className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 font-mono text-sm tracking-widest text-brand-dark uppercase placeholder:tracking-normal placeholder:normal-case focus:border-brand-purple focus:outline-none sm:flex-1"
        />
        <SubmitButton pendingLabel="Comprovant…">Bescanviar</SubmitButton>
      </form>

      {state.error && <p className="mt-3 text-sm text-error">{state.error}</p>}
    </section>
  );
}
