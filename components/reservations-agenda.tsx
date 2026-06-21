"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  SERVICE_LABELS,
  RESERVATION_STATUS_LABELS,
  formatTime,
  formatDayHeading,
  dayKey,
} from "@/lib/labels";
import type { ReservationListItem } from "@/lib/data/reservations";
import type { ReservationStatus } from "@/types/database";

const STATUS_TONE: Record<ReservationStatus, "info" | "success" | "danger"> = {
  booked: "info",
  completed: "success",
  cancelled: "danger",
};

type DayGroup = { day: string; items: ReservationListItem[] };

function groupByDay(items: ReservationListItem[]): DayGroup[] {
  const map = new Map<string, ReservationListItem[]>();
  for (const r of items) {
    const key = dayKey(r.scheduledAt);
    (map.get(key) ?? map.set(key, []).get(key)!).push(r);
  }
  return [...map.entries()].map(([day, items]) => ({ day, items }));
}

export function ReservationsAgenda({
  reservations,
  trainers,
  nowISO,
}: {
  reservations: ReservationListItem[];
  trainers: { id: string; name: string }[];
  nowISO: string;
}) {
  const [trainer, setTrainer] = useState("");
  const [status, setStatus] = useState("");

  const { upcoming, past } = useMemo(() => {
    const filtered = reservations.filter(
      (r) =>
        (!trainer || r.trainerId === trainer) &&
        (!status || r.status === status),
    );
    const upcoming = filtered
      .filter((r) => r.scheduledAt >= nowISO)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const past = filtered
      .filter((r) => r.scheduledAt < nowISO)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    return { upcoming: groupByDay(upcoming), past: groupByDay(past) };
  }, [reservations, trainer, status, nowISO]);

  const selectClass =
    "rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20";

  return (
    <div className="flex flex-col gap-8">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={trainer}
          onChange={(e) => setTrainer(e.target.value)}
          className={selectClass}
          aria-label="Filtrar per entrenador/a"
        >
          <option value="">Tots els entrenadors</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
          aria-label="Filtrar per estat"
        >
          <option value="">Tots els estats</option>
          {(
            Object.keys(RESERVATION_STATUS_LABELS) as ReservationStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {RESERVATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <Section title="Properes" groups={upcoming} emptyLabel="No hi ha reserves properes." />
      <Section title="Passades" groups={past} emptyLabel="No hi ha reserves passades." />
    </div>
  );
}

function Section({
  title,
  groups,
  emptyLabel,
}: {
  title: string;
  groups: DayGroup[];
  emptyLabel: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold tracking-widest text-brand-muted uppercase">
        {title}
      </h2>
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white px-5 py-6 text-sm text-brand-muted">
          {emptyLabel}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.day}>
              <h3 className="mb-2 text-sm font-bold text-brand-dark first-letter:uppercase">
                {formatDayHeading(g.day)}
              </h3>
              <div className="overflow-hidden rounded-2xl border border-brand-border bg-white divide-y divide-brand-border">
                {g.items.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
                  >
                    <span className="w-12 font-bold text-brand-purple">
                      {formatTime(r.scheduledAt)}
                    </span>
                    <span className="font-bold text-brand-dark">
                      {r.clientName}
                    </span>
                    <span className="text-brand-muted">
                      {SERVICE_LABELS[r.serviceType]}
                    </span>
                    {r.trainerName && (
                      <span className="text-brand-muted">· {r.trainerName}</span>
                    )}
                    <span className="ml-auto">
                      <Badge tone={STATUS_TONE[r.status]}>
                        {RESERVATION_STATUS_LABELS[r.status]}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
