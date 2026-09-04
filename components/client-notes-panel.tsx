import Link from "next/link";
import { TAP } from "@/lib/utils";

/**
 * Notes internes d'un client, separades en clíniques i generals.
 *
 * Només de lectura: l'edició viu al formulari de client (admin). El trainer
 * les veu però no les edita, igual que abans de separar-les en dues.
 */
export function ClientNotesPanel({
  clinicalNotes,
  generalNotes,
  editHref,
}: {
  clinicalNotes: string | null;
  generalNotes: string | null;
  /** Si es passa, es mostra l'enllaç d'edició (només l'admin en té). */
  editHref?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-brand-clinical/30 bg-brand-clinical/5 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wide text-brand-clinical uppercase">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-4 w-4"
          >
            {/* Creu sanitària */}
            <path d="M6.25 1.5h3.5v3.25H13v3.5H9.75V13h-3.5V8.25H3v-3.5h3.25V1.5Z" />
          </svg>
          Notes clíniques
        </h2>
        {clinicalNotes?.trim() ? (
          <p className="text-sm whitespace-pre-wrap text-brand-charcoal">
            {clinicalNotes}
          </p>
        ) : (
          <p className="text-sm text-brand-muted">
            Sense notes clíniques.
          </p>
        )}
      </section>

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
            className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
          >
            Editar notes →
          </Link>
        </div>
      )}
    </div>
  );
}
