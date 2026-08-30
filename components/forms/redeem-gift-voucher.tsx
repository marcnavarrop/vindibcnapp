"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("redeem");
  const tp = useTranslations("picker");
  const tl = useTranslations("labels.service");
  const [state, action] = useActionState(
    redeemGiftVoucherAction,
    {} as RedeemState,
  );

  if (state.ok)
    return (
      <section className="flex flex-col items-center gap-2 rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
        <AnimatedFeedback type="success" />
        <p className="font-bold text-success">{t("okTitle")}</p>
        <p className="text-sm text-brand-charcoal">
          {t("okBody", {
            detail: `${tp("sessions", { count: state.sessions ?? 0 })} · ${
              state.serviceType ? tl(state.serviceType) : ""
            }`,
          })}
        </p>
      </section>
    );

  return (
    <section className="rounded-2xl border border-brand-border bg-white p-5">
      <h2 className="text-sm font-bold text-brand-dark">{t("title")}</h2>
      <p className="mt-0.5 mb-3 text-xs text-brand-muted">
        {t("hint")}
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
        <SubmitButton pendingLabel={t("checking")}>{t("submit")}</SubmitButton>
      </form>

      {state.errorCode && (
        <p className="mt-3 text-sm text-error">{t(`errors.${state.errorCode}`)}</p>
      )}
    </section>
  );
}
