"use client";

import { useState } from "react";
import { TAP, clsx } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import { SERVICE_LABELS, RESERVATION_STATUS_LABELS, formatDate } from "@/lib/labels";
import type { ReservationListItem } from "@/lib/data/reservations";

/**
 * Les pròximes reserves, les seves i les del centre.
 *
 * Arriben ja retallades i ordenades del servidor, una llista per pestanya (el
 * quantes el decideix la pàgina, `app/(trainer)/trainer/page.tsx`).
 * Abans arribava TOT l'històric del centre al navegador i es filtrava aquí.
 */
export function TrainerUpcomingReservations({
  mine,
  all,
  myId,
  failed,
}: {
  mine: ReservationListItem[];
  myId: string;
  all: ReservationListItem[];
  /** La consulta ha fallat: es diu, en comptes de "no hi ha reserves". */
  failed?: boolean;
}) {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const upcoming = scope === "mine" ? mine : all;

  return (
    <section className="rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Properes reserves
        </h2>
        <div className="inline-flex rounded-lg border border-brand-border bg-white p-0.5">
          {(["mine", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={clsx(
                "rounded-md px-3 py-1 text-xs font-bold transition-colors",
                scope === s
                  ? "bg-brand-purple text-white"
                  : "text-brand-muted hover:text-brand-dark",
                TAP,
              )}
            >
              {s === "mine" ? "Els meus" : "Tots"}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-brand-border">
        {failed ? (
          <p role="alert" className="px-5 py-3 text-sm text-error">
            No s&apos;han pogut carregar les properes reserves.
          </p>
        ) : upcoming.length === 0 ? (
          <p className="px-5 py-3 text-sm text-brand-muted">
            No hi ha reserves properes.
          </p>
        ) : (
          upcoming.map((r) => {
            const isOwn = r.trainerId === myId;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
              >
                <span className="font-bold text-brand-dark">
                  {formatDate(r.scheduledAt)}
                </span>
                <span className={isOwn ? "" : "text-brand-muted"}>
                  {r.clientName}
                  {!isOwn && r.trainerName && (
                    <span className="ml-1 text-brand-muted">
                      amb {r.trainerName}
                    </span>
                  )}
                </span>
                <span className="text-brand-muted">
                  {SERVICE_LABELS[r.serviceType]}
                </span>
                <Badge tone="info">
                  {RESERVATION_STATUS_LABELS[r.status]}
                </Badge>
                {r.isComplimentary && <Badge tone="warn">Cortesia</Badge>}
                {isOwn && (
                  <div className="ml-auto">
                    <AddToCalendarButton
                      serviceType={r.serviceType}
                      otherPartyName={r.clientName}
                      scheduledAt={r.scheduledAt}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
