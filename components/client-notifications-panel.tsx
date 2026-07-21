"use client";

import { useTransition, useState } from "react";
import {
  resendInviteAction,
  notifyNewExercisesAction,
  notifyNextSessionAction,
  type NotificationActionResult,
} from "@/app/actions/client-notification-actions";

type ButtonState = { loading: boolean; result: NotificationActionResult | null };

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
          className="shrink-0 rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-bold tracking-wide text-white uppercase disabled:opacity-50 hover:bg-brand-purple-light"
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

export function ClientNotificationsPanel({ clientId }: { clientId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <NotifButton
        label="Reenviar invitació"
        description="Envia un nou correu d'accés al client (ideal si el primer va caducar o no va arribar)."
        onAction={() => resendInviteAction(clientId)}
      />
      <NotifButton
        label="Notificar exercicis nous"
        description="Avisa el client que té exercicis nous assignats a la seva àrea."
        onAction={() => notifyNewExercisesAction(clientId)}
      />
      <NotifButton
        label="Recordatori de propera sessió"
        description="Envia un recordatori de la seva propera sessió programada."
        onAction={() => notifyNextSessionAction(clientId)}
      />
    </div>
  );
}
