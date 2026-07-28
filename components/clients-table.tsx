"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ClientListItem } from "@/lib/data/clients";
import { ResendInviteButton } from "@/components/resend-invite-button";
import { normalizeForSearch, digitsOnly } from "@/lib/utils";

export function ClientsTable({ clients }: { clients: ClientListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return clients;
    const qDigits = digitsOnly(query);
    return clients.filter((c) => {
      if (
        normalizeForSearch(c.fullName).includes(q) ||
        normalizeForSearch(c.email).includes(q) ||
        normalizeForSearch(c.phone).includes(q) ||
        normalizeForSearch(c.trainerName).includes(q)
      )
        return true;
      // El telèfon es desa amb prefix i espais ("+34 600 100 001"): comparant
      // només dígits, cercar "600100" també el troba.
      return qDigits.length > 0 && digitsOnly(c.phone).includes(qDigits);
    });
  }, [query, clients]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-brand-muted"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m13.5 13.5 3.5 3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nom, correu o telèfon…"
            aria-label="Cerca clients"
            className="w-full rounded-lg border border-brand-border bg-white py-2.5 pr-3 pl-9 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </div>
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
                  No s&apos;ha trobat cap client amb aquesta cerca.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
