import Link from "next/link";
import { CENTER_TZ } from "@/lib/config";
import { TAP } from "@/lib/utils";
import type { ArchivedEntry, ArchivedPatient, ArchivedPatientSummary } from "@/lib/data/clinical-archive";
import type { ClinicalArchiveKind } from "@/types/database";

/**
 * Les pantalles de l'ARXIU CLÍNIC (0119), compartides entre l'admin i els
 * fisios: la llista i la fitxa en només lectura. En català, com tota l'àrea de
 * l'equip. No hi ha cap botó per editar ni esborrar: no se'n pot fer res, i la
 * base tampoc no ho deixaria.
 */

const ddmmyyyy = (day: string | null) => (day ? day.slice(0, 10).split("-").reverse().join("/") : "—");
const dateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ca-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: CENTER_TZ,
      }).format(new Date(iso))
    : "—";

export const KIND_LABELS: Record<ClinicalArchiveKind, string> = {
  first_visit: "Primera visita",
  followup: "Seguiment",
  session_note: "Nota de sessió",
  document: "Document",
  consent: "Consentiment de salut",
};

const KIND_ORDER: ClinicalArchiveKind[] = ["first_visit", "followup", "session_note", "document", "consent"];

function DemoTag() {
  return (
    <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-bold text-neutral-ink" data-archive-demo>
      Demo
    </span>
  );
}

export function ArchiveIntro() {
  return (
    <p className="mt-1 max-w-3xl text-sm text-brand-muted">
      L&apos;historial clínic de fisioteràpia dels clients que s&apos;han donat de baixa, que la Llei
      21/2000 obliga a conservar 15 anys des de l&apos;última atenció. Només lectura: no es pot editar
      ni esborrar. Cada consulta queda registrada. Quan vencen, les entrades s&apos;esborren soles.
    </p>
  );
}

export function ArchiveList({ patients, basePath }: { patients: ArchivedPatientSummary[]; basePath: string }) {
  if (!patients.length)
    return (
      <p className="mt-6 rounded-2xl border border-brand-border bg-white p-5 text-sm text-brand-muted" data-archive-empty>
        Encara no hi ha cap pacient arxivat.
      </p>
    );
  return (
    <ul className="mt-6 flex flex-col gap-2" data-archive-list>
      {patients.map((p) => (
        <li key={p.id}>
          <Link
            href={`${basePath}/${p.id}`}
            className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-brand-border bg-white px-4 py-3 hover:border-brand-purple ${TAP}`}
            data-archive-patient={p.id}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-bold text-brand-dark">{p.fullName}</span>
              {p.isDemo && <DemoTag />}
            </span>
            <span className="text-xs text-brand-muted">
              Última atenció {ddmmyyyy(p.lastCareOn)} · es conserva fins al {ddmmyyyy(p.purgeAfter)} ·{" "}
              {p.entries} {p.entries === 1 ? "entrada" : "entrades"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EntryCard({ e, documentHref }: { e: ArchivedEntry; documentHref: (id: string) => string }) {
  return (
    <li className="rounded-xl border border-brand-border bg-white p-4" data-archive-entry={e.kind}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-brand-muted">
        <span>
          {e.kind === "session_note" && e.sessionOn ? <>Sessió del {dateTime(e.sessionOn)} · </> : null}
          {e.kind === "consent" ? "Donat" : e.kind === "document" ? "Pujat" : "Escrit"} el {dateTime(e.writtenAt)}
          {e.authorName && e.kind !== "consent" ? <> · {e.authorName}</> : null}
          {e.updatedAt && e.updatedAt !== e.writtenAt && e.kind !== "document" && e.kind !== "consent" ? (
            <> · editat el {dateTime(e.updatedAt)}</>
          ) : null}
        </span>
        <span>Es conserva fins al {ddmmyyyy(e.purgeAfter)}</span>
      </div>
      {e.body && <p className="mt-2 text-sm whitespace-pre-wrap text-brand-charcoal">{e.body}</p>}
      {e.kind === "document" && (
        <p className="mt-2 text-sm text-brand-charcoal">
          <a
            href={documentHref(e.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand-purple hover:underline"
            data-archive-document
          >
            {e.fileName ?? "Document"}
          </a>
          {e.fileSize ? <span className="text-brand-muted"> · {Math.max(1, Math.round(e.fileSize / 1024))} kB</span> : null}
          {e.description ? <span className="block text-brand-muted">{e.description}</span> : null}
        </p>
      )}
      {e.kind === "consent" && (
        <p className="mt-2 text-sm text-brand-charcoal">
          Versió {e.consentVersion ?? "—"}
          {e.consentRevokedAt ? (
            <span className="text-attention"> · retirat el {dateTime(e.consentRevokedAt)}</span>
          ) : null}
        </p>
      )}
    </li>
  );
}

export function ArchiveRecord({
  patient,
  basePath,
  exportHref,
}: {
  patient: ArchivedPatient;
  basePath: string;
  exportHref?: string;
}) {
  const documentHref = (id: string) => `${basePath}/document/${id}`;
  return (
    <>
      <Link href={basePath} className="text-sm font-bold text-brand-purple hover:underline">
        ← Arxiu clínic
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl text-brand-dark">
            <span className="break-words">{patient.fullName}</span>
            {patient.isDemo && <DemoTag />}
          </h1>
          <p className="mt-1 text-sm text-brand-muted">Només lectura · cada consulta queda registrada.</p>
        </div>
        {exportHref && (
          <a
            href={exportHref}
            className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-brand-purple bg-white px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-brand-purple uppercase hover:bg-brand-purple/10 ${TAP}`}
            data-archive-export
          >
            Exportar
          </a>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border border-brand-border bg-white p-5 text-sm sm:grid-cols-2">
        {[
          ["Data de naixement", ddmmyyyy(patient.birthDate)],
          ["Correu", patient.email ?? "—"],
          ["Telèfon", patient.phone ?? "—"],
          ["Última atenció", ddmmyyyy(patient.lastCareOn)],
          ["Arxivat", `${dateTime(patient.archivedAt)}${patient.archivedByName ? ` · ${patient.archivedByName}` : ""}`],
          ["Es conserva fins al", ddmmyyyy(patient.purgeAfter)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs font-bold text-brand-muted uppercase">{k}</dt>
            <dd className="break-words text-brand-charcoal">{v}</dd>
          </div>
        ))}
      </dl>

      {KIND_ORDER.map((kind) => {
        const list = patient.entryList.filter((e) => e.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="mt-6" data-archive-section={kind}>
            <h2 className="text-lg text-brand-dark">
              {KIND_LABELS[kind]} {list.length > 1 && <span className="text-brand-muted">({list.length})</span>}
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {list.map((e) => (
                <EntryCard key={e.id} e={e} documentHref={documentHref} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
