"use client";

import { TAP } from "@/lib/utils";
import { useActionState } from "react";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { useTranslations } from "next-intl";
import { cancelOwnReservationAction } from "@/app/(client)/client/reservas/actions";
import { canCancelAt } from "@/lib/cancellation";

export function CancelReservationButton({
  id,
  scheduledAt,
  minCancellationHours,
  className = "",
}: {
  id: string;
  scheduledAt: string;
  minCancellationHours: number;
  className?: string;
}) {
  const t = useTranslations("reservas");
  const te = useTranslations("reservas.errors");
  const [state, action] = useActionState(cancelOwnReservationAction, {});

  const canCancel = canCancelAt(scheduledAt, minCancellationHours);

  if (!canCancel) {
    return (
      <span className={`text-xs text-brand-muted italic ${className}`}>
        {t("own.tooLateShort")}
      </span>
    );
  }

  return (
    <div className={className}>
      {/* El mateix «Sí, cancel·la / No, torna» que la resta de l'app: abans
          aquí era un «Segur? Sí / No» propi. */}
      <ConfirmInline
        compact
        action={action}
        fields={{ id }}
        trigger={t("cancel")}
        triggerClassName={`rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-error hover:bg-error/10 active:bg-error/20 ${TAP}`}
        question={t("own.confirmCancel")}
        confirmLabel={t("own.yesCancel")}
        pendingLabel={t("own.cancelling")}
        backLabel={t("own.noBack")}
      />
      {state.errorCode && (
        <p className="mt-1 max-w-[16rem] text-xs text-error">
          {te(state.errorCode, { hours: state.errorHours ?? 0 })}
        </p>
      )}
    </div>
  );
}
