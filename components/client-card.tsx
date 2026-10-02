import Link from "next/link";
import type { ClientsPageItem } from "@/lib/data/clients";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";

/**
 * UN CLIENT, AL MÒBIL (admin i professional). Tota la targeta obre la fitxa:
 * l'enllaç és el nom i el seu `after:` s'estén per sobre de tota la targeta.
 * El WhatsApp i el que arribi per `subline` (a l'admin, «Reenviar invitació»)
 * van per sobre amb `relative z-10`, perquè tocar-los faci el que diuen i no
 * obri la fitxa. Un sol enllaç per targeta: el tabulador passa un cop per
 * client, com a la taula.
 */
export function ClientCard({
  c,
  href,
  subline,
}: {
  c: ClientsPageItem;
  href: string;
  /** Una línia entre el nom i les xifres (a l'admin, el correu i reenviar). */
  subline?: React.ReactNode;
}) {
  return (
    <li
      className="relative flex flex-col gap-0.5 rounded-2xl border border-brand-border bg-white px-3.5 py-3 active:bg-brand-bg"
      data-testid="client-card"
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          href={href}
          className="min-w-0 truncate font-bold text-brand-dark after:absolute after:inset-0 after:rounded-2xl after:content-['']"
        >
          {c.fullName}
        </Link>
        {/* El buit de la icona es reserva sempre, com a la taula. */}
        <span className="relative z-10 -my-3 flex h-11 w-11 shrink-0 items-center justify-center">
          <WhatsAppLink phone={c.phone} name={c.fullName} variant="icon" className="h-11 w-11" />
        </span>
      </div>
      {subline && <div className="relative flex min-w-0 items-center justify-between gap-3 text-[13px] text-brand-muted">{subline}</div>}
      <p className="truncate text-[13px] text-brand-muted">
        {c.trainerName ?? <span className="italic">Sense assignar</span>} ·{" "}
        {c.activeBonos === 1 ? "1 bo actiu" : `${c.activeBonos} bons actius`} ·{" "}
        <span className="font-bold text-brand-purple">{c.remainingSessions}</span>{" "}
        {c.remainingSessions === 1 ? "sessió" : "sessions"}
      </p>
    </li>
  );
}
