import { Badge } from "@/components/ui/badge";
import {
  SERVICE_LABELS,
  BONO_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatDate,
  formatEur,
} from "@/lib/labels";
import { clsx } from "@/lib/utils";
import type { ClientBono } from "@/lib/data/clients";
import type { Subscription } from "@/lib/data/subscriptions";

/**
 * El to de cada estat, el mateix que `BONO_STATUS_TONE` de les targetes de
 * Bons. No s'importa d'allà: aquell mòdul és de client, i al servidor una
 * constant seva no és l'objecte sinó una referència.
 */
const TONE: Record<ClientBono["status"], "success" | "neutral" | "danger" | "attention"> = {
  active: "success",
  completed: "neutral",
  cancelled: "danger",
  pending_payment: "attention",
  expired: "danger",
  unpaid: "danger",
};

/** Els que encara diuen alguna cosa: per cobrar, decaiguts i actius. */
const LIVE: ClientBono["status"][] = ["pending_payment", "unpaid", "active"];

function BonoItem({
  b,
  today,
  actions,
}: {
  b: ClientBono;
  today: string;
  actions?: React.ReactNode;
}) {
  const consumed = b.totalSessions - b.remainingSessions;
  const expired = b.status === "active" && !!b.expiresAt && b.expiresAt < today;
  return (
    <li
      className={clsx(
        "flex flex-col gap-1.5 rounded-2xl border border-brand-border px-4 py-3",
        b.status === "pending_payment" || b.status === "unpaid" ? "bg-attention-bg" : "bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-bold text-brand-dark">{SERVICE_LABELS[b.serviceType]}</span>
        {expired ? (
          <Badge tone="danger">Caducat</Badge>
        ) : (
          <Badge tone={TONE[b.status]} icon={b.status === "pending_payment" ? "pending" : undefined}>
            {BONO_STATUS_LABELS[b.status]}
          </Badge>
        )}
      </div>
      <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-sm text-brand-muted">
        <span className="tabular-nums">
          {b.remainingSessions} / {b.totalSessions} sessions
        </span>
        <span className="tabular-nums">{formatEur(b.price)}</span>
        {b.expiresAt && (
          <span>
            {expired || b.status === "expired" ? "va caducar" : "caduca"} el {formatDate(b.expiresAt)}
          </span>
        )}
        {b.subscriptionId && <span>de la subscripció</span>}
      </p>
      {b.status === "pending_payment" && consumed > 0 && (
        <p className="text-[13px] font-semibold text-attention">
          {consumed === 1 ? "1 sessió ja consumida" : `${consumed} sessions ja consumides`} sense cobrar
        </p>
      )}
      {actions && <div className="mt-1 flex flex-wrap justify-end gap-2">{actions}</div>}
    </li>
  );
}

/**
 * Els bons d'un client a la pestanya «Bons i pagaments»: targetes, com a la
 * resta de llistes de bons des del pas 6 de la pasada d'UX. Els vius a dalt
 * (per cobrar primer); els acabats, plegats amb el seu comptador.
 */
export function ClientBonoList({
  bonos,
  today,
  actions,
}: {
  bonos: ClientBono[];
  today: string;
  actions?: (b: ClientBono) => React.ReactNode;
}) {
  const live = bonos
    .filter((b) => LIVE.includes(b.status))
    .sort((a, b) => LIVE.indexOf(a.status) - LIVE.indexOf(b.status));
  const done = bonos.filter((b) => !LIVE.includes(b.status));

  if (bonos.length === 0) return <p className="px-1 text-sm text-brand-muted">Sense bons.</p>;

  return (
    <div className="flex flex-col gap-3">
      {live.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {live.map((b) => (
            <BonoItem key={b.id} b={b} today={today} actions={actions?.(b)} />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-brand-muted">No té cap bo actiu.</p>
      )}
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none px-1 text-xs font-bold tracking-wide text-brand-purple uppercase hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Veure els bons acabats ({done.length})</span>
            <span className="hidden group-open:inline">Amagar els bons acabats</span>
          </summary>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {done.map((b) => (
              <BonoItem key={b.id} b={b} today={today} actions={actions?.(b)} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const SUB_STATUS: Record<Subscription["status"], { label: string; tone: "success" | "danger" | "neutral" | "attention" }> = {
  active: { label: "Activa", tone: "success" },
  past_due: { label: "Aturada per impagament", tone: "danger" },
  cancelled: { label: "Cancel·lada", tone: "neutral" },
  paused: { label: "Congelada", tone: "attention" },
};

/**
 * La subscripció viva del client, només per llegir. Gestionar-la (pausar,
 * donar de baixa) és a Bons i pagaments → Subscripcions, on viu amb Stripe.
 * Només a l'administració: el professional no en veu els imports.
 */
export function SubscriptionCard({ sub }: { sub: Subscription }) {
  const st = SUB_STATUS[sub.status];
  return (
    <section className="flex flex-col gap-1.5 rounded-2xl border border-brand-border bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wide text-brand-muted uppercase">Subscripció</p>
          <p className="font-bold text-brand-dark">{sub.packageName}</p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-sm text-brand-muted">
        <span>{SERVICE_LABELS[sub.serviceType]}</span>
        <span className="tabular-nums">{sub.sessionsPerCycle} sessions al mes</span>
        <span className="tabular-nums">{formatEur(sub.unitPrice)} al mes</span>
        <span>{PAYMENT_METHOD_LABELS[sub.paymentMethod]}</span>
      </p>
      <p className="text-sm text-brand-charcoal">
        {sub.status === "paused"
          ? sub.resumeOn
            ? `Congelada fins al ${formatDate(sub.resumeOn)}.`
            : "Congelada sense data de represa."
          : sub.cancelAtPeriodEnd && sub.nextRenewalOn
            ? `Es dona de baixa el ${formatDate(sub.nextRenewalOn)}.`
            : sub.nextRenewalOn
              ? `Propera renovació: ${formatDate(sub.nextRenewalOn)}.`
              : `Des del ${formatDate(sub.startedOn)}.`}
      </p>
    </section>
  );
}
