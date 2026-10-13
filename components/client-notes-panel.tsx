import Link from "next/link";
import { TAP } from "@/lib/utils";

/**
 * Les notes GENERALS d'un client. Les clíniques ja no són aquí: són a
 * l'historial clínic (0110), amb la seva pestanya i la seva RLS.
 *
 * Només de lectura: l'edició viu al formulari de client (admin).
 */
export function ClientNotesPanel({
  generalNotes,
  editHref,
}: {
  generalNotes: string | null;
  /** Si es passa, es mostra l'enllaç d'edició (només l'admin en té). */
  editHref?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-brand-border bg-white p-5">
        <h2 className="mb-2 text-sm font-bold tracking-wide text-brand-muted uppercase">
          Notes generals
        </h2>
        {generalNotes?.trim() ? (
          <p className="text-sm whitespace-pre-wrap text-brand-charcoal">
            {generalNotes}
          </p>
        ) : (
          <p className="text-sm text-brand-muted">Sense notes generals.</p>
        )}
      </section>

      {editHref && (
        <div>
          <Link
            href={editHref}
            className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`}
          >
            Editar notes →
          </Link>
        </div>
      )}
    </div>
  );
}
