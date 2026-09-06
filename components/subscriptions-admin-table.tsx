"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS, formatEur, formatDate } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import {
  adminCancelSubscriptionAction,
  adminChangePriceAction,
  type AdminSubscriptionState,
} from "@/app/(admin)/admin/subscripcions/actions";
import type { PaymentMethod, ServiceType, SubscriptionStatus, BonoStatus } from "@/types/database";

export type SubscriptionRow = {
  id: string;
  clientId: string;
  clientName: string;
  packageName: string;
  serviceType: ServiceType;
  sessionsPerCycle: number;
  unitPrice: number;
  paymentMethod: PaymentMethod;
  status: SubscriptionStatus;
  anchorDay: number;
  nextRenewalOn: string | null;
  cancelAtPeriodEnd: boolean;
  currentCycleStart: string;
  sessionsLeft: number;
  cycleBonoStatus: BonoStatus | null;
  extrasUsed: number;
  extrasMax: number;
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Activa",
  past_due: "Aturada per impagament",
  cancelled: "Cancel·lada",
};
const STATUS_TONE: Record<SubscriptionStatus, "success" | "warn" | "neutral"> = {
  active: "success",
  past_due: "warn",
  cancelled: "neutral",
};

type Filter = "live" | "past_due" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "live", label: "Vives" },
  { key: "past_due", label: "Aturades" },
  { key: "all", label: "Totes" },
];

export function SubscriptionsAdminTable({ rows }: { rows: SubscriptionRow[] }) {
  const [filter, setFilter] = useState<Filter>("live");
  const [cancelling, setCancelling] = useState<SubscriptionRow | null>(null);
  const [pricing, setPricing] = useState<SubscriptionRow | null>(null);

  const [cancelState, cancelAction] = useActionState(
    adminCancelSubscriptionAction,
    {} as AdminSubscriptionState,
  );
  const [priceState, priceAction] = useActionState(
    adminChangePriceAction,
    {} as AdminSubscriptionState,
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        filter === "all"
          ? true
          : filter === "past_due"
            ? r.status === "past_due"
            : r.status !== "cancelled",
      ),
    [rows, filter],
  );
  const pastDue = useMemo(() => rows.filter((r) => r.status === "past_due").length, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${TAP} ${
              filter === f.key
                ? "bg-brand-purple text-white"
                : "bg-brand-bg text-brand-muted hover:text-brand-dark"
            }`}
          >
            {f.label}
            {f.key === "past_due" && pastDue > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-orange px-1.5 text-xs text-white">
                {pastDue}
              </span>
            )}
          </button>
        ))}
      </div>

      {(cancelState.error || priceState.error) && (
        <p className="text-sm text-error">{cancelState.error ?? priceState.error}</p>
      )}
      {(cancelState.ok || priceState.ok) && (
        <p className="text-sm font-bold text-success">{cancelState.ok ?? priceState.ok}</p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-brand-bg text-left text-xs font-bold tracking-wide text-brand-muted uppercase">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Paquet</th>
              <th className="px-4 py-3">Mensual</th>
              <th className="px-4 py-3">Aquest mes</th>
              <th className="px-4 py-3">Renovació</th>
              <th className="px-4 py-3">Estat</th>
              <th className="px-4 py-3 text-right">Accions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {filtered.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3 font-bold text-brand-dark">
                  <Link href={`/admin/clients/${r.clientId}`} className="hover:text-brand-purple">
                    {r.clientName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {r.packageName}
                  <span className="block text-xs text-brand-muted">
                    {SERVICE_LABELS[r.serviceType]} · {r.sessionsPerCycle} sessions
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatEur(r.unitPrice)}
                  <span className="block text-xs text-brand-muted">
                    {r.paymentMethod === "card" ? "Targeta" : "Al centre"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-bold text-brand-purple">{r.sessionsLeft}</span>
                  <span className="text-brand-muted"> disponibles</span>
                  {/* El que fa útil la pantalla: si el mes en curs està cobrat.
                      Un 'pending_payment' aquí vol dir que, en arribar la
                      renovació, la subscripció s'aturarà. */}
                  {(r.cycleBonoStatus === "pending_payment" ||
                    r.cycleBonoStatus === "unpaid") && (
                    <span className="block text-xs font-bold text-brand-orange">
                      mes sense cobrar
                    </span>
                  )}
                  {r.extrasMax > 0 && r.extrasUsed > 0 && (
                    <span className="block text-xs text-brand-muted">
                      {r.extrasUsed}/{r.extrasMax} extra
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  {r.nextRenewalOn ? formatDate(r.nextRenewalOn) : "—"}
                  <span className="block text-xs">dia {r.anchorDay} de cada mes</span>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  {r.cancelAtPeriodEnd && r.status !== "cancelled" && (
                    <span className="mt-1 block text-xs font-bold text-brand-orange">
                      no es renovarà
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-1.5">
                    {r.paymentMethod === "cash" && r.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => setPricing(r)}
                        className={`rounded-md bg-brand-bg px-2.5 py-1 text-xs font-bold text-brand-dark hover:bg-brand-border ${TAP}`}
                      >
                        Canviar preu
                      </button>
                    )}
                    {r.status !== "cancelled" && !r.cancelAtPeriodEnd && (
                      <button
                        type="button"
                        onClick={() => setCancelling(r)}
                        className={`rounded-md bg-brand-orange px-2.5 py-1 text-xs font-bold text-white hover:opacity-90 ${TAP}`}
                      >
                        Donar de baixa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-brand-muted">
                  Cap subscripció en aquest filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        ariaClose="Tancar"
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="Donar de baixa la subscripció?"
        actions={
          <>
            <button
              type="button"
              onClick={() => setCancelling(null)}
              className={`rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP}`}
            >
              Cancel·lar
            </button>
            <form action={cancelAction} onSubmit={() => setCancelling(null)}>
              <input type="hidden" name="subscriptionId" value={cancelling?.id ?? ""} />
              <SubmitButton pendingLabel="Donant de baixa…">Donar de baixa</SubmitButton>
            </form>
          </>
        }
      >
        <p className="text-sm text-brand-charcoal">
          {cancelling?.clientName} deixarà de renovar-se. El mes que ja té pagat
          el conserva fins que caduqui: la baixa és a final de període, mai a
          l&apos;instant.
          {cancelling?.paymentMethod === "card" && (
            <> També s&apos;avisarà Stripe perquè deixi de cobrar.</>
          )}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        ariaClose="Tancar"
        open={pricing !== null}
        onClose={() => setPricing(null)}
        title="Canviar el preu mensual"
        actions={
          <>
            <button
              type="button"
              onClick={() => setPricing(null)}
              className={`rounded-lg px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP}`}
            >
              Cancel·lar
            </button>
            <form action={priceAction} onSubmit={() => setPricing(null)}>
              <input type="hidden" name="subscriptionId" value={pricing?.id ?? ""} />
              <input type="hidden" name="unitPrice" id="admin-price-value" />
              <SubmitButton pendingLabel="Desant…">Desar</SubmitButton>
            </form>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-brand-charcoal">
            El preu es congela a l&apos;alta a posta, i és el que evita que a un
            subscriptor li pugi el rebut sol. Això és la sortida per a un import
            pactat amb {pricing?.clientName}.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              defaultValue={pricing?.unitPrice}
              onChange={(e) => {
                const hidden = document.getElementById("admin-price-value") as HTMLInputElement | null;
                if (hidden) hidden.value = e.target.value;
              }}
              className="w-32 rounded-lg border border-brand-border px-3 py-2 text-sm"
            />
            <span className="text-brand-muted">€ cada mes</span>
          </label>
          <p className="text-xs text-brand-muted">
            S&apos;aplica a partir de la propera renovació. El bo del mes en curs
            conserva el preu amb què es va emetre.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
