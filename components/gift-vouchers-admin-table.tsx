"use client";

import { useMemo, useState } from "react";
import { TAP, clsx } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  SERVICE_LABELS,
  GIFT_VOUCHER_STATUS_LABELS,
  sessionsLabel,
  formatEur,
  formatDate,
} from "@/lib/labels";
import {
  markGiftVoucherPaidAction,
  cancelGiftVoucherAction,
} from "@/app/(admin)/admin/vals-regal/actions";
import type { GiftVoucher } from "@/lib/data/gift-vouchers";
import type { GiftVoucherStatus } from "@/types/database";

const STATUS_TONE: Record<
  GiftVoucherStatus,
  "success" | "neutral" | "danger" | "warn"
> = {
  // Pendent és el cas que demana feina: el val no val res fins que algú cobra.
  pending_payment: "warn",
  active: "success",
  redeemed: "neutral",
  // Caducat i anul·lat són pèrdua, com als bons: es marquen en vermell.
  expired: "danger",
  cancelled: "danger",
};

type Filter = "all" | "pending_payment" | "active" | "redeemed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tots" },
  { key: "pending_payment", label: "Pendents de pagament" },
  { key: "active", label: "Actius" },
  { key: "redeemed", label: "Bescanviats" },
];

export function GiftVouchersAdminTable({ vouchers }: { vouchers: GiftVoucher[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const pendingCount = useMemo(
    () => vouchers.filter((v) => v.status === "pending_payment").length,
    [vouchers],
  );
  const filtered = useMemo(
    () => (filter === "all" ? vouchers : vouchers.filter((v) => v.status === filter)),
    [vouchers, filter],
  );

  return (
    <div>
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-brand-border bg-white p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
              filter === f.key
                ? "bg-brand-purple text-white"
                : "text-brand-muted hover:text-brand-dark",
              TAP,
            )}
          >
            {f.label}
            {f.key === "pending_payment" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-orange px-1.5 text-[10px] text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Codi</th>
              <th className="px-4 py-3 font-bold">Comprador</th>
              <th className="px-4 py-3 font-bold">Paquet</th>
              <th className="px-4 py-3 font-bold">Preu</th>
              <th className="px-4 py-3 font-bold">Caduca</th>
              <th className="px-4 py-3 font-bold">Estat</th>
              <th className="px-4 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-b border-brand-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-mono font-bold whitespace-nowrap text-brand-purple">
                    {v.code}
                  </span>
                  <span className="block text-xs text-brand-muted">
                    {v.recipientName ? `per a ${v.recipientName} · ` : ""}
                    {formatDate(v.purchasedAt)}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-brand-dark">
                  {v.buyerName}
                </td>
                <td className="px-4 py-3">
                  {v.packageName}
                  <span className="block text-xs text-brand-muted">
                    {sessionsLabel(v.totalSessions)} · {SERVICE_LABELS[v.serviceType]}
                  </span>
                </td>
                <td className="px-4 py-3">{formatEur(v.price)}</td>
                <td className="px-4 py-3 text-brand-muted">
                  {v.status === "redeemed" && v.redeemedAt ? (
                    <span className="text-brand-dark">
                      Bescanviat {formatDate(v.redeemedAt)}
                      {v.redeemedByName && (
                        <span className="block text-xs text-brand-muted">
                          per {v.redeemedByName}
                        </span>
                      )}
                    </span>
                  ) : (
                    formatDate(v.expiresAt)
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge tone={STATUS_TONE[v.status]}>
                    {GIFT_VOUCHER_STATUS_LABELS[v.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <a
                      href={`/client/regals/${v.id}/pdf`}
                      className={`text-xs font-bold text-brand-muted hover:text-brand-purple ${TAP}`}
                    >
                      PDF
                    </a>
                    {v.status === "pending_payment" && (
                      <form action={markGiftVoucherPaidAction}>
                        <input type="hidden" name="voucherId" value={v.id} />
                        <button
                          type="submit"
                          className={`rounded-md bg-brand-purple px-2.5 py-1 text-xs font-bold whitespace-nowrap text-white hover:bg-brand-purple-light ${TAP}`}
                        >
                          Marcar com pagat
                        </button>
                      </form>
                    )}
                    {/* Un val bescanviat ja no es toca: el bo existeix i té
                        sessions que algú pot haver començat a fer servir. */}
                    {v.status !== "redeemed" && v.status !== "cancelled" && (
                      <form action={cancelGiftVoucherAction}>
                        <input type="hidden" name="voucherId" value={v.id} />
                        <button
                          type="submit"
                          className={`rounded-md border border-brand-border px-2.5 py-1 text-xs font-bold whitespace-nowrap text-brand-muted hover:border-error hover:text-error ${TAP}`}
                        >
                          Anul·lar
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-brand-muted"
                >
                  Sense vals en aquest filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
