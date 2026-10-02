"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MarkBonoPaidButton, type MarkPaidState } from "@/components/forms/mark-bono-paid-button";
import { CancelBonoButton } from "@/components/forms/cancel-bono-button";
import { SERVICE_LABELS, BONO_STATUS_LABELS, formatEur, formatDate } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import type { BonoListItem } from "@/lib/data/bonos";
import type { BonoStatus } from "@/types/database";

/** El to de cada estat, el mateix a la taula i a la targeta. */
export const BONO_STATUS_TONE: Record<BonoStatus, "success" | "neutral" | "danger" | "attention" | "info"> = {
  active: "success",
  completed: "neutral",
  cancelled: "danger",
  pending_payment: "attention",
  // Caducat NO és neutral com "completat": s'han perdut sessions pagades.
  expired: "danger",
  // Anul·lat per impagament: també és pèrdua, i l'etiqueta n'explica el motiu.
  unpaid: "danger",
};

/**
 * UN BO, AL MÒBIL (l'admin i el professional). A 375 px la taula feia 880 px
 * dins de 325: el preu, l'estat i «Marcar com pagat» quedaven fora de la
 * pantalla. La targeta ho ensenya tot:
 *
 * - a dalt, el client (enllaç a la seva fitxa) i l'estat;
 * - al mig, servei · sessions · preu · caducitat, i a part l'avís de sessions
 *   gastades sense cobrar;
 * - a baix, NOMÉS si hi ha res a cobrar, «Marcar com pagat» a tot l'ample amb
 *   «Anul·lar» al costat. Un bo que només es pot anul·lar porta «Anul·lar» al
 *   final de la línia de dades: no creix una fila per un sol botó.
 *
 * Què es pot fer ho decideix qui la pinta (`canPay`, `canCancel`): l'admin i el
 * professional no poden anul·lar els mateixos bons (`cancelBlockFor`).
 */
export function BonoCard({
  b,
  today,
  href,
  admin = false,
  canPay,
  canCancel,
  payAction,
  cancelAction,
}: {
  b: BonoListItem;
  /** Dia del CENTRE (si un decaigut ja ha passat de data). */
  today: string;
  /** La fitxa del client, de l'àrea que la pinta. */
  href: string;
  admin?: boolean;
  canPay: boolean;
  canCancel: boolean;
  payAction: (prev: MarkPaidState, formData: FormData) => Promise<MarkPaidState>;
  cancelAction: React.ComponentProps<typeof CancelBonoButton>["action"];
}) {
  const consumed = b.totalSessions - b.remainingSessions;
  const cancel = (inCard: true | "link") => (
    <CancelBonoButton
      inCard={inCard}
      action={cancelAction}
      bonoId={b.id}
      clientName={b.clientName}
      serviceType={b.serviceType}
      price={b.price}
      totalSessions={b.totalSessions}
      status={b.status}
    />
  );
  return (
    <li className="flex flex-col gap-1.5 rounded-2xl border border-brand-border bg-white px-3.5 py-3" data-testid="bono-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-bold text-brand-dark">
          <Link
            href={href}
            className={`underline decoration-brand-border decoration-2 underline-offset-4 hover:text-brand-purple hover:decoration-brand-purple ${TAP}`}
          >
            {b.clientName}
          </Link>
        </span>
        <Badge tone={BONO_STATUS_TONE[b.status]} icon={b.status === "pending_payment" ? "pending" : undefined}>{BONO_STATUS_LABELS[b.status]}</Badge>
      </div>
      <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-sm text-brand-muted">
        <span className="font-semibold text-brand-charcoal">{SERVICE_LABELS[b.serviceType]}</span>
        <span className="tabular-nums">
          {b.remainingSessions} / {b.totalSessions} sessions
        </span>
        <span className="tabular-nums">{formatEur(b.price)}</span>
        {b.expiresAt && <span>caduca {formatDate(b.expiresAt)}</span>}
        {!canPay && canCancel && <span className="ml-auto">{cancel("link")}</span>}
      </p>
      {b.status === "pending_payment" && consumed > 0 && (
        <p className="text-[13px] font-semibold text-attention">
          {consumed === 1 ? "1 sessió ja consumida" : `${consumed} sessions ja consumides`} sense cobrar
        </p>
      )}
      {canPay && (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1">
            <MarkBonoPaidButton
              admin={admin}
              fullWidth
              action={payAction}
              bonoId={b.id}
              clientName={b.clientName}
              serviceType={b.serviceType}
              price={b.price}
              remainingSessions={b.remainingSessions}
              totalSessions={b.totalSessions}
              status={b.status}
              expired={!!b.expiresAt && b.expiresAt < today}
            />
          </div>
          {canCancel && cancel(true)}
        </div>
      )}
    </li>
  );
}
