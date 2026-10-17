import Link from "next/link";
import { CENTER_TZ } from "@/lib/config";
import { SERVICE_LABELS } from "@/lib/labels";
import { centerDateStr, centerWeekStart } from "@/lib/center-time";
import type { ClientSessionNote } from "@/lib/data/session-notes";

/**
 * Les notes de sessió d'un client, juntes (0125). Abans només es veien
 * sessió a sessió, obrint la reserva a l'agenda: qui n'havia escrit una no la
 * trobava si no sabia de quina setmana era.
 *
 * Només lectura: la nota s'escriu i s'edita des de la reserva, com sempre. Qui
 * en veu cadascuna ho ha decidit la base (0125): aquí no es filtra res més.
 */
const when = (iso: string) =>
  new Intl.DateTimeFormat("ca-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CENTER_TZ,
  }).format(new Date(iso));

export function SessionNotesList({
  title,
  notes,
  failed,
  agendaBase,
  empty,
  marker,
}: {
  title: string;
  notes: ClientSessionNote[];
  failed: boolean;
  /** L'agenda on s'obre la sessió: `/admin/reservas` o `/trainer/reservas`. */
  agendaBase: string;
  empty: string;
  /** Per a les proves: quina llista és. */
  marker: "training" | "physio";
}) {
  return (
    <section className="rounded-2xl border border-brand-border bg-white p-5" data-session-notes={marker}>
      <h2 className="mb-3 text-sm font-bold tracking-wide text-brand-muted uppercase">{title}</h2>
      {failed && (
        <p role="alert" className="mb-3 text-sm text-error">
          No s&apos;han pogut llegir totes les notes. Torna-ho a provar en una estona.
        </p>
      )}
      {notes.length === 0 ? (
        <p className="text-sm text-brand-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => {
            const day = centerDateStr(new Date(n.scheduledAt));
            const href = `${agendaBase}?setmana=${centerWeekStart(day)}&dia=${day}`;
            return (
              <li key={n.reservationId} className="rounded-xl border border-brand-border p-3.5" data-session-note={n.reservationId}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-brand-muted">
                  <span>
                    <span className="font-bold text-brand-dark">{when(n.scheduledAt)}</span> · {SERVICE_LABELS[n.serviceType]}
                    {n.trainerName ? <> · {n.trainerName}</> : null}
                    {n.status === "cancelled" ? <> · cancel·lada</> : null}
                  </span>
                  <Link href={href} className="font-bold text-brand-purple hover:underline">
                    Veure la sessió
                  </Link>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-brand-charcoal">{n.body}</p>
                {n.authorName && n.authorName !== n.trainerName && (
                  <p className="mt-1 text-xs text-brand-muted">Escrita per {n.authorName}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
