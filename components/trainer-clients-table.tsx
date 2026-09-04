"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TAP, TAP_SURFACE, clsx } from "@/lib/utils";
import type { ClientListItem } from "@/lib/data/clients";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";

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
                TAP,
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
          placeholder="Cerca per nom, correu o professional…"
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
              <th className="px-4 py-3 font-bold">Professional</th>
              <th className="px-4 py-3 font-bold">Bons actius</th>
              <th className="px-4 py-3 font-bold">Sessions rest.</th>
              <th className="px-4 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className={`border-b border-brand-border last:border-0 hover:bg-brand-bg/50 active:bg-brand-bg ${TAP_SURFACE}`}
              >
                <CellLink href={`/trainer/clients/${c.id}`} first>
                  <span className="font-bold text-brand-dark">{c.fullName}</span>
                </CellLink>
                <CellLink href={`/trainer/clients/${c.id}`}>
                  {c.trainerName ?? (
                    <span className="text-brand-muted italic">
                      Sense assignar
                    </span>
                  )}
                </CellLink>
                <CellLink href={`/trainer/clients/${c.id}`}>
                  {c.activeBonos}
                </CellLink>
                <CellLink href={`/trainer/clients/${c.id}`}>
                  <span className="font-bold text-brand-purple">
                    {c.remainingSessions}
                  </span>
                </CellLink>
                {/* Cel·la nova, FORA dels CellLink: si la icona anés dins d'un
                    enllaç a la fitxa, tocar-la obriria la fitxa i no WhatsApp.
                    Mateix criteri que la taula de l'admin.

                    El buit es reserva sempre, com allà. Aquí no hi ha text que
                    es pugui partir, però la icona fa 32 px d'alçada: sense el
                    buit, les files amb telèfon feien 57 px i les que no, 44,5.
                    La mateixa irregularitat, en vertical. */}
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                      <WhatsAppLink phone={c.phone} name={c.fullName} variant="icon" />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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

/** Vegeu `CellLink` a `clients-table.tsx`: mateixa raó, mateixa forma. */
function CellLink({
  href,
  first,
  children,
}: {
  href: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <td className="p-0">
      <Link
        href={href}
        tabIndex={first ? undefined : -1}
        className="block px-4 py-3"
      >
        {children}
      </Link>
    </td>
  );
}
