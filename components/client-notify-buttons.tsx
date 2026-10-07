"use client";

import { useTransition, useState } from "react";
import {
  notifyNewExercisesAction,
  notifyNextSessionAction,
  type NotificationActionResult,
} from "@/app/actions/client-notification-actions";
import { TAP } from "@/lib/utils";

function NotifButton({
  label,
  description,
  onAction,
}: {
  label: string;
  description: string;
  onAction: () => Promise<NotificationActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<NotificationActionResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await onAction();
      setResult(res);
    });
  }

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-brand-dark">{label}</p>
          <p className="text-xs text-brand-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className={`shrink-0 rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-bold tracking-wide text-white uppercase disabled:opacity-50 hover:bg-brand-purple-light ${TAP}`}
        >
          {isPending ? "Enviant…" : "Enviar"}
        </button>
      </div>
      {result && (
        <p
          className={`mt-1 text-xs font-bold ${result.ok ? "text-success" : "text-error"}`}
        >
          {result.ok ? "✓" : "✗"} {result.message}
        </p>
      )}
    </div>
  );
}

/*
 * Els avisos manuals ja no tenen pestanya pròpia: cadascun va al costat del
 * que avisa. El recordatori, a les sessions; els exercicis nous, a
 * Entrenament; reenviar la invitació, al menú «Més» de la capçalera.
 */

export function NotifyNewExercisesButton({ clientId }: { clientId: string }) {
  return (
    <NotifButton
      label="Notificar exercicis nous"
      description="Avisa el client que té exercicis nous assignats a la seva àrea."
      onAction={() => notifyNewExercisesAction(clientId)}
    />
  );
}

export function NextSessionReminderButton({ clientId }: { clientId: string }) {
  return (
    <NotifButton
      label="Recordatori de propera sessió"
      description="Envia un recordatori de la seva propera sessió programada."
      onAction={() => notifyNextSessionAction(clientId)}
    />
  );
}
