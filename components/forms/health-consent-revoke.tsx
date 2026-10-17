"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { revokeHealthConsentAction } from "@/app/(client)/client/configuracio/consent-actions";

/**
 * Retirar el consentiment de dades de salut (0118), al costat d'on es dona i
 * igual de fàcil: un botó i la confirmació de sempre, que diu què passarà.
 *
 * `active`: hi ha un consentiment vigent per retirar. Es queda muntat encara
 * que no n'hi hagi: en retirar-lo la pàgina es refresca i el «Has retirat…»
 * no ha de desaparèixer amb ella.
 */
export function HealthConsentRevoke({ active }: { active: boolean }) {
  const t = useTranslations("config.privacy");
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  if (done && !active) return <p role="status" className="text-sm font-bold text-success">{t("revoked")}</p>;
  if (!active) return null;

  return (
    <div className="flex flex-col gap-2">
      <ConfirmInline
        action={async () => {
          setFailed(false);
          start(async () => {
            const r = await revokeHealthConsentAction();
            if (r.ok) setDone(true);
            else setFailed(true);
          });
        }}
        pending={pending}
        trigger={t("revoke")}
        question={t("revokeQuestion")}
        consequence={t("revokeConsequence")}
        confirmLabel={t("revokeConfirm")}
        pendingLabel={t("revokePending")}
        backLabel={t("revokeBack")}
      />
      {failed && <p role="alert" className="text-sm text-error">{t("errors.revokeFailed")}</p>}
    </div>
  );
}
