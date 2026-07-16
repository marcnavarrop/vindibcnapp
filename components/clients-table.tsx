"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ClientListItem } from "@/lib/data/clients";
import { ResendInviteButton } from "@/components/resend-invite-button";

export function ClientsTable({ clients }: { clients: ClientListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.trainerName ?? "").toLowerCase().includes(q),
    );
  }, [query, clients]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nom, correu o entrenador/a…"
          className="w-full max-w-sm rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        />
        <span className="text-sm whitespace-nowrap text-brand-muted">
          {filtered.length} de {clients.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Contacte</th>
              <th className="px-4 py-3 font-bold">Entrenador/a</th>
              <th className="px-4 py-3 font-bold">Bons actius</th>
              <th className="px-4 py-3 font-bold">Sessions rest.</th>
              <th className="px-4 py-3 font-bold"></th>
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
                    href={`/admin/clients/${c.id}`}
                    className="hover:text-brand-purple hover:underline"
                  >
                    {c.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-brand-muted">
                  <div>{c.email}</div>
                  {c.phone && <div className="text-xs">{c.phone}</div>}
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
                <td className="px-4 py-3 text-right">
                  <ResendInviteButton profileId={c.profileId} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-muted"
                >
                  Sense resultats per a “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
