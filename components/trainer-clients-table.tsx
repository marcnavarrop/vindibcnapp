"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "@/lib/utils";
import type { ClientListItem } from "@/lib/data/clients";

/**
 * Tabla de clientes del área de entrenador/a con un conmutador
 * "Els meus / Tots". Cualquier ficha se puede abrir; las acciones de gestión
 * dependen de si el cliente es suyo (eso lo controla la propia ficha + RLS).
 */
export function TrainerClientsTable({
  clients,
  myIds,
}: {
  clients: ClientListItem[];
  myIds: string[];
}) {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [query, setQuery] = useState("");
  const mine = useMemo(() => new Set(myIds), [myIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => (scope === "mine" ? mine.has(c.id) : true))
      .filter(
        (c) =>
          !q ||
          c.fullName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.trainerName ?? "").toLowerCase().includes(q),
      );
  }, [clients, scope, mine, query]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-brand-border bg-white p-0.5">
          {(["mine", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
                scope === s
                  ? "bg-brand-purple text-white"
                  : "text-brand-muted hover:text-brand-dark",
              )}
            >
              {s === "mine" ? "Els meus" : "Tots"}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nom, correu o entrenador/a…"
          className="w-full max-w-sm rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        />
        <span className="text-sm whitespace-nowrap text-brand-muted">
          {filtered.length} clients
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Entrenador/a</th>
              <th className="px-4 py-3 font-bold">Bons actius</th>
              <th className="px-4 py-3 font-bold">Sessions rest.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-brand-border last:border-0 hover:bg-brand-bg/50"
              >
                <td className="px-4 py-3 font-bold text-brand-dark">
                  <Link
                    href={`/trainer/clients/${c.id}`}
                    className="hover:text-brand-purple hover:underline"
                  >
                    {c.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {c.trainerName ?? (
                    <span className="text-brand-muted italic">
                      Sense assignar
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{c.activeBonos}</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-brand-purple">
                    {c.remainingSessions}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-brand-muted"
                >
                  Sense clients.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
