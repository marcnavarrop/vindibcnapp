"use client";

import { useMemo, useState } from "react";
import { clsx } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import { SERVICE_LABELS, RESERVATION_STATUS_LABELS, formatDate } from "@/lib/labels";
import type { ReservationListItem } from "@/lib/data/reservations";

const MAX_ALL = 15;

export function TrainerUpcomingReservations({
  reservations,
  myId,
}: {
  reservations: ReservationListItem[];
  myId: string;
}) {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const nowISO = new Date().toISOString();

  const upcoming = useMemo(() => {
    const future = reservations
      .filter((r) => r.status === "booked" && r.scheduledAt >= nowISO)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    if (scope === "mine") return future.filter((r) => r.trainerId === myId).slice(0, 6);
    return future.slice(0, MAX_ALL);
  }, [reservations, scope, myId, nowISO]);

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
              )}
            >
              {s === "mine" ? "Els meus" : "Tots"}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-brand-border">
        {upcoming.length === 0 ? (
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
