"use client";

import { FilterChips, filterChipClass, ChipCheck } from "@/components/ui/filter-chips";
import { useMemo, useState } from "react";
import { TAP } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { MarkVoucherPaidButton } from "@/components/forms/mark-voucher-paid-button";
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
  "success" | "neutral" | "danger" | "attention"
> = {
  // Pendent és el cas que demana feina: el val no val res fins que algú cobra.
  pending_payment: "attention",
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
      <FilterChips label="Filtre d'estat">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={filterChipClass(filter === f.key)}
          >
            <ChipCheck on={filter === f.key} />
            {f.label}
            {f.key === "pending_payment" && pendingCount > 0 && (
              <span className="rounded-full bg-attention px-1.5 text-[10px] text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </FilterChips>

      {/* Al mòbil, una targeta per val; a partir de 768 px, la taula. */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="vouchers-cards">
        {filtered.map((v) => (
          <VoucherCard key={v.id} v={v} />
        ))}
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-brand-border bg-white px-4 py-8 text-center text-sm text-brand-muted">
            Sense vals en aquest filtre.
          </li>
        )}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-brand-border bg-white md:block">
        <table className="w-full min-w-[48rem] text-left text-sm" data-testid="vouchers-table">
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
                  <Badge tone={STATUS_TONE[v.status]} icon={v.status === "pending_payment" ? "pending" : undefined}>
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
                      <MarkVoucherPaidButton
                        action={markGiftVoucherPaidAction}
                        voucherId={v.id}
                        code={v.code}
                        buyerName={v.buyerName}
                        packageName={v.packageName}
                        price={v.price}
                      />
                    )}
                    <CancelVoucher v={v} />
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

/**
 * Anul·lar un val, a la taula i a la targeta. Un val bescanviat ja no es toca:
 * el bo existeix i té sessions que algú pot haver començat a fer servir. Anul·lar
 * no retorna res: si el val estava pagat, el retorn dels diners es fa fora de
 * l'app, i es diu abans.
 */
function CancelVoucher({ v, inCard = false }: { v: GiftVoucher; inCard?: boolean }) {
  if (v.status === "redeemed" || v.status === "cancelled") return null;
  return (
    <ConfirmInline
      compact
      action={cancelGiftVoucherAction}
      fields={{ voucherId: v.id }}
      trigger="Anul·lar"
      triggerClassName={
        inCard
          ? `inline-flex h-11 items-center px-1 text-sm font-bold whitespace-nowrap text-error hover:underline ${TAP}`
          : `rounded-md border border-brand-border px-2.5 py-1 text-xs font-bold whitespace-nowrap text-brand-muted hover:border-error hover:text-error ${TAP}`
      }
      question={`Anul·lar el val ${v.code}?`}
      consequence={
        v.status === "active"
          ? "El codi deixa de funcionar. L'app no retorna els diners: si cal, es fa a part."
          : "El codi deixa de funcionar."
      }
      confirmLabel="Sí, anul·la"
      pendingLabel="Anul·lant…"
    />
  );
}

/**
 * UN VAL, AL MÒBIL. A dalt el codi i l'estat; a sota qui el va comprar, el
 * paquet, el preu i la caducitat (o qui el va bescanviar). A baix, «Marcar com
 * pagat» si està pendent, i el PDF i «Anul·lar» com a enllaços al costat: com
 * a botons amb vora no hi cabien tots tres a 375 px.
 */
function VoucherCard({ v }: { v: GiftVoucher }) {
  const pending = v.status === "pending_payment";
  const canCancel = v.status !== "redeemed" && v.status !== "cancelled";
  return (
    <li className="flex flex-col gap-1.5 rounded-2xl border border-brand-border bg-white px-3.5 py-3" data-testid="voucher-card">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-base font-bold whitespace-nowrap text-brand-purple">{v.code}</span>
        <Badge tone={STATUS_TONE[v.status]} icon={v.status === "pending_payment" ? "pending" : undefined}>{GIFT_VOUCHER_STATUS_LABELS[v.status]}</Badge>
      </div>
      <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-sm text-brand-muted">
        <span className="font-semibold text-brand-charcoal">{v.buyerName}</span>
        <span>{v.packageName}</span>
        <span className="tabular-nums">{formatEur(v.price)}</span>
      </p>
      <p className="text-[13px] text-brand-muted">
        {sessionsLabel(v.totalSessions)} · {SERVICE_LABELS[v.serviceType]}
        {v.recipientName ? ` · per a ${v.recipientName}` : ""} ·{" "}
        {v.status === "redeemed" && v.redeemedAt
          ? `bescanviat ${formatDate(v.redeemedAt)}${v.redeemedByName ? ` per ${v.redeemedByName}` : ""}`
          : `caduca ${formatDate(v.expiresAt)}`}
      </p>
      <div className={`flex items-center justify-end gap-3 ${pending ? "mt-1" : "-my-2"}`}>
        {pending && (
          <div className="flex-1">
            <MarkVoucherPaidButton
              fullWidth
              action={markGiftVoucherPaidAction}
              voucherId={v.id}
              code={v.code}
              buyerName={v.buyerName}
              packageName={v.packageName}
              price={v.price}
            />
          </div>
        )}
        <a
          href={`/client/regals/${v.id}/pdf`}
          className={`inline-flex h-11 items-center px-1 text-sm font-bold text-brand-purple hover:underline ${TAP}`}
        >
          PDF
        </a>
        {canCancel && <CancelVoucher v={v} inCard />}
      </div>
    </li>
  );
}
