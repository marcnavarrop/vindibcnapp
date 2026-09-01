"use client";

import { useActionState, useState } from "react";
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
  const [confirming, setConfirming] = useState(false);

  const canCancel = canCancelAt(scheduledAt, minCancellationHours);

  if (!canCancel) {
    return (
      <span className={`text-xs text-brand-muted italic ${className}`}>
        {t("own.tooLateShort")}
      </span>
    );
  }

  if (confirming) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-brand-muted">{t("own.sure")}</span>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="rounded-md bg-error px-2 py-1 text-xs font-bold text-white hover:opacity-80"
          >
            {t("own.yes")}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-brand-muted hover:text-brand-dark"
        >
          {t("own.no")}
        </button>
        {state.errorCode && (
          <p className="text-xs text-error">{te(state.errorCode, { hours: state.errorHours ?? 0 })}</p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-error hover:bg-error/10"
      >
        {t("cancel")}
      </button>
      {state.errorCode && (
        <p className="mt-1 max-w-[16rem] text-xs text-error">
          {te(state.errorCode, { hours: state.errorHours ?? 0 })}
        </p>
      )}
    </div>
  );
}
