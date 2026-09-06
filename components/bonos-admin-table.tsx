"use client";

import { useMemo, useState } from "react";
import { TAP, clsx } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SERVICE_LABELS, BONO_STATUS_LABELS, formatEur, formatDate } from "@/lib/labels";
import { markBonoPaidAction } from "@/app/(admin)/admin/bonos/actions";
import type { BonoListItem } from "@/lib/data/bonos";
import type { BonoStatus } from "@/types/database";

const STATUS_TONE: Record<
  BonoStatus,
  "success" | "neutral" | "danger" | "warn"
> = {
  active: "success",
  completed: "neutral",
  cancelled: "danger",
  pending_payment: "warn",
  // Caducat NO és neutral com "completat": s'han perdut sessions pagades.
  expired: "danger",
  // Anul·lat per impagament: també és pèrdua, i l'etiqueta n'explica el motiu.
  unpaid: "danger",
};

type Filter = "all" | "pending_payment" | "unpaid" | "active";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tots" },
  { key: "pending_payment", label: "Pendents de pagament" },
  { key: "unpaid", label: "Decaiguts sense cobrar" },
  { key: "active", label: "Actius" },
];

export function BonosAdminTable({
  bonos,
  today,
}: {
  bonos: BonoListItem[];
  /** Dia del CENTRE. Ve del servidor: el navegador pot anar en una altra zona. */
  today: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const pendingCount = useMemo(
    () => bonos.filter((b) => b.status === "pending_payment").length,
    [bonos],
  );
  const filtered = useMemo(
    () => (filter === "all" ? bonos : bonos.filter((b) => b.status === filter)),
    [bonos, filter],
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
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Servei</th>
              <th className="px-4 py-3 font-bold">Sessions</th>
              <th className="px-4 py-3 font-bold">Preu</th>
              <th className="px-4 py-3 font-bold">Caduca</th>
              <th className="px-4 py-3 font-bold">Estat</th>
              <th className="px-4 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr
                key={b.id}
                className="border-b border-brand-border last:border-0"
              >
                <td className="px-4 py-3 font-bold text-brand-dark">
                  {b.clientName}
                </td>
                <td className="px-4 py-3">{SERVICE_LABELS[b.serviceType]}</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-brand-purple">
                    {b.remainingSessions}
                  </span>
                  <span className="text-brand-muted"> / {b.totalSessions}</span>
                  {b.status === "pending_payment" &&
                    b.totalSessions - b.remainingSessions > 0 && (
                      <span className="ml-2 text-xs font-bold text-brand-orange">
                        ({b.totalSessions - b.remainingSessions} ja consumides)
                      </span>
                    )}
                </td>
                <td className="px-4 py-3">{formatEur(b.price)}</td>
                <td className="px-4 py-3 text-brand-muted">
                  {b.expiresAt ? formatDate(b.expiresAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[b.status]}>
                    {BONO_STATUS_LABELS[b.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {(b.status === "pending_payment" || b.status === "unpaid") && (
                    <form action={markBonoPaidAction}>
                      <input type="hidden" name="bonoId" value={b.id} />
                      <button
                        type="submit"
                        // Un bo decaigut també es pot cobrar: fins ara el client
                        // es plantava al centre amb els diners i no hi havia on
                        // anotar-los. El text avisa del que NO torna, que són
                        // les hores: l'escombrat les va alliberar i poden ser
                        // d'algú altre.
                        title={
                          b.status !== "unpaid"
                            ? undefined
                            : b.expiresAt && b.expiresAt < today
                              ? "El cobrament s'anota i, si és d'una subscripció, la torna a posar en marxa. El bo NO es recupera: ja ha passat de data."
                              : "Recupera el bo amb les sessions que li quedaven. Les reserves que es van cancel·lar en decaure NO tornen: s'han de tornar a demanar."
                        }
                        className={`rounded-md px-2.5 py-1 text-xs font-bold text-white ${
                          b.status === "unpaid"
                            ? "bg-brand-orange hover:opacity-90"
                            : "bg-brand-purple hover:bg-brand-purple-light"
                        } ${TAP}`}
                      >
                        {b.status !== "unpaid"
                          ? "Marcar com pagat"
                          : b.expiresAt && b.expiresAt < today
                            ? // No promet el que no pot complir: un bo que ja ha
                              // passat de data tornarà a caducar tot seguit. El
                              // cobrament sí que s'anota, i és el que desbloqueja
                              // la subscripció.
                              "Només cobrar"
                            : "Cobrar i recuperar"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-muted"
                >
                  Sense bons en aquest filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
