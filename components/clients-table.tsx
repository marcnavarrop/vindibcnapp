"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ClientListItem } from "@/lib/data/clients";
import { ResendInviteButton } from "@/components/resend-invite-button";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { normalizeForSearch, digitsOnly, TAP_SURFACE } from "@/lib/utils";

export function ClientsTable({
  clients,
  trainerFilter = null,
}: {
  clients: ClientListItem[];
  /**
   * Filtre per entrenador actiu, resolt al servidor via ?trainer=<id>.
   * `name` és null si l'id no resol cap entrenador (enllaç antic o eliminat).
   */
  trainerFilter?: { name: string | null } | null;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return clients;
    const qDigits = digitsOnly(query);
    return clients.filter((c) => {
      // Només dades del propi client: cercar "Laia" no ha de retornar els
      // clients de l'entrenadora Laia. Per això hi ha el filtre d'entrenador.
      if (
        normalizeForSearch(c.fullName).includes(q) ||
        normalizeForSearch(c.email).includes(q) ||
        normalizeForSearch(c.phone).includes(q)
      )
        return true;
      // Comparant només dígits, cercar "600100" troba el número tant si està
      // desat pelat com amb prefix o espais. (Deia aquí que es desava com
      // "+34 600 100 001"; això és la llavor del mode simulació. A la base real
      // són dígits pelats i el camp no té cap validació de format.)
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

        {trainerFilter && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple/10 py-1 pr-1 pl-3 text-xs font-bold text-brand-purple">
            Professional: {trainerFilter.name ?? "desconegut/da"}
            <Link
              href="/admin/clients"
              aria-label="Treure el filtre de professional"
              title="Treure el filtre"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-brand-purple/20"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="h-3 w-3"
              >
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </Link>
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Contacte</th>
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
                <CellLink href={`/admin/clients/${c.id}`} first>
                  <span className="font-bold text-brand-dark">{c.fullName}</span>
                </CellLink>
                <CellLink href={`/admin/clients/${c.id}`}>
                  <span className="text-brand-muted">
                    <span className="block">{c.email}</span>
                    {c.phone && <span className="block text-xs">{c.phone}</span>}
                  </span>
                </CellLink>
                <CellLink href={`/admin/clients/${c.id}`}>
                  {c.trainerName ?? (
                    <span className="text-brand-muted italic">
                      Sense assignar
                    </span>
                  )}
                </CellLink>
                <CellLink href={`/admin/clients/${c.id}`}>
                  {c.activeBonos}
                </CellLink>
                <CellLink href={`/admin/clients/${c.id}`}>
                  <span className="font-bold text-brand-purple">
                    {c.remainingSessions}
                  </span>
                </CellLink>
                {/* Fora de l'enllaç a posta: si el botó de reenviar la
                    invitació o el de WhatsApp hi anessin a dins, tocar-los
                    obriria la fitxa en comptes de fer el que diuen. */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {/*
                      El buit de la icona es reserva SEMPRE, tingui telèfon o no.
                      Sense això, la icona li menjava una trentena de píxels a
                      "Reenviar invitació" només a les files que en tenien —78,9 px
                      contra 101,8 mesurats a 375 px—, i el text es partia en dues
                      línies en unes files i en una a les altres. La columna ha de
                      ser igual de ampla a totes; que la casella estigui buida és
                      indiferent.
                    */}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                      <WhatsAppLink phone={c.phone} name={c.fullName} variant="icon" />
                    </span>
                    <ResendInviteButton profileId={c.profileId} />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-muted"
                >
                  {clients.length > 0 || !trainerFilter
                    ? "No s'ha trobat cap client amb aquesta cerca."
                    : trainerFilter.name
                      ? `${trainerFilter.name} no té cap client assignat.`
                      : "Aquest professional ja no existeix."}
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
 * Una cel·la que és, sencera, un enllaç a la fitxa.
 *
 * Va cel·la a cel·la perquè una `<tr>` no es pot embolicar amb un `<Link>`:
 * l'HTML només admet `<td>` com a filla d'una fila, i qualsevol altra cosa el
 * navegador la treu de la taula en carregar. L'encoixinat viatja a dins de
 * l'enllaç perquè el que respon al dit sigui la cel·la sencera i no només el
 * text que hi ha al mig.
 *
 * Només el primer rep el focus del tabulador. Amb cinc enllaços iguals per
 * fila, recórrer la taula amb el teclat repetiria cinc vegades el mateix destí
 * abans de passar a la fila següent; així es tabula com abans, un per client.
 */
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
