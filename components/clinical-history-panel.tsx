"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmInline } from "@/components/ui/confirm-inline";
import { formatDate } from "@/lib/labels";
import { TAP } from "@/lib/utils";
import {
  addFollowupAction,
  clinicalHistoryOpenedAction,
  deleteFollowupAction,
  editFollowupAction,
  saveFirstVisitAction,
  type ClinicalFormState,
} from "@/app/actions/clinical-history-actions";
import type { ClinicalHistory, ClinicalFollowup } from "@/lib/data/clinical-history";
import { CLINICAL_MAX } from "@/lib/clinical-access";

const LINK = `text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`;

/**
 * L'HISTORIAL CLÍNIC D'UN CLIENT (0110): el consentiment de salut, la «Primera
 * visita» i el «Seguiment». El que es pot fer arriba calculat de la pàgina
 * (`lib/clinical-access.ts`); la base ho torna a mirar.
 *
 * OBRIR NO ÉS CARREGAR. Les pestanyes de la fitxa es pinten totes de cop i les
 * altres només s'amaguen. Per això «vist» (l'avís de novetat) i el registre
 * d'accessos es disparen quan el panell es VEU de debò (`IntersectionObserver`:
 * un element amagat amb `display: none` no s'hi creua mai), i un sol cop.
 */
export function ClinicalHistoryPanel({
  clientId,
  history,
  consent,
  canWrite,
  canDelete,
  viewerId,
  isAdmin,
  truncated,
}: {
  clientId: string;
  history: ClinicalHistory;
  /** El consentiment de dades de salut: signat (amb data) o no. */
  consent: { grantedAt: string; version: string } | null;
  canWrite: boolean;
  canDelete: boolean;
  viewerId: string;
  isAdmin: boolean;
  /** S'ha arribat al límit de seguiments que es carreguen. */
  truncated: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (opened.current || !entries.some((e) => e.isIntersecting)) return;
      opened.current = true;
      void clinicalHistoryOpenedAction(clientId);
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [clientId]);

  return (
    <div ref={root} className="flex flex-col gap-5" data-clinical-history>
      {/* Consentiment: es diu si està signat i quan. Si no, l'avís, però no es
          bloqueja l'escriptura (decisió d'en Marc). */}
      {consent ? (
        <p className="rounded-xl border border-brand-border bg-neutral-bg px-3.5 py-2.5 text-sm text-neutral-ink" data-consent-signed>
          Consentiment de dades de salut <b className="font-bold">signat</b> el {formatDate(consent.grantedAt)} (versió {consent.version}).
        </p>
      ) : (
        <p className="rounded-xl border border-attention bg-attention-bg px-3.5 py-2.5 text-sm text-attention" data-consent-missing>
          <b className="font-bold">Consentiment de dades de salut pendent.</b> No el té signat:
          abans d&apos;anotar-hi dades de salut, que l&apos;accepti des de la seva àrea.
        </p>
      )}

      <FirstVisitCard clientId={clientId} visit={history.firstVisit} canWrite={canWrite} />

      <section className="rounded-2xl border border-brand-border bg-white p-5">
        <h2 className="mb-3 text-sm font-bold tracking-wide text-brand-muted uppercase">Seguiment</h2>
        {canWrite && <NewFollowupForm clientId={clientId} />}
        {history.followups.length === 0 ? (
          <p className="text-sm text-brand-muted">Encara no hi ha cap seguiment.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-border">
            {history.followups.map((f) => (
              <FollowupRow
                key={f.id}
                f={f}
                canEdit={isAdmin || (canWrite && f.authorId === viewerId)}
                canDelete={canDelete}
              />
            ))}
          </ul>
        )}
        {truncated && (
          <p className="mt-2 text-xs text-brand-muted">
            N&apos;hi ha més: es mostren els més recents.
          </p>
        )}
      </section>
    </div>
  );
}

function FirstVisitCard({
  clientId,
  visit,
  canWrite,
}: {
  clientId: string;
  visit: ClinicalHistory["firstVisit"];
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<ClinicalFormState, FormData>(
    saveFirstVisitAction.bind(null, clientId),
    {},
  );
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  return (
    <section className="rounded-2xl border border-brand-clinical/30 bg-brand-clinical/5 p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-clinical uppercase">Primera visita</h2>
        {canWrite && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={LINK}>
            {visit ? "Editar" : "Escriure-la"}
          </button>
        )}
      </div>
      {editing ? (
        <form action={action} className="flex flex-col gap-3">
          <TextAreaField
            label="Primera visita"
            name="body"
            required
            rows={8}
            maxLength={CLINICAL_MAX}
            defaultValue={visit?.body ?? ""}
            placeholder="Motiu de consulta, antecedents, exploració, diagnòstic, pla…"
          />
          {state.error && <p className="text-sm text-error">{state.error}</p>}
          <div className="flex items-center gap-4">
            <SubmitButton>Desar</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}>
              Cancel·lar
            </button>
          </div>
        </form>
      ) : visit ? (
        <>
          <p className="text-sm whitespace-pre-wrap text-brand-charcoal">{visit.body}</p>
          <p className="mt-2 text-xs text-brand-muted">
            {visit.createdByName ? `${visit.createdByName} · ` : ""}
            {formatDate(visit.createdAt)}
            {visit.updatedAt !== visit.createdAt && (
              <> · editada{visit.updatedByName ? ` per ${visit.updatedByName}` : ""} el {formatDate(visit.updatedAt)}</>
            )}
          </p>
        </>
      ) : (
        <p className="text-sm text-brand-muted">Encara no hi ha primera visita.</p>
      )}
    </section>
  );
}

function NewFollowupForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState<ClinicalFormState, FormData>(
    addFollowupAction.bind(null, clientId),
    {},
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="mb-4 flex flex-col gap-3">
      <TextAreaField
        label="Nou seguiment"
        name="body"
        required
        rows={3}
        maxLength={CLINICAL_MAX}
        placeholder="Com ha anat la sessió, evolució, pautes…"
      />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <div>
        <SubmitButton>Afegir</SubmitButton>
      </div>
    </form>
  );
}

function FollowupRow({
  f,
  canEdit,
  canDelete,
}: {
  f: ClinicalFollowup;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<ClinicalFormState, FormData>(editFollowupAction, {});
  const [delState, del, deleting] = useActionState<ClinicalFormState, FormData>(deleteFollowupAction, {});
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  return (
    <li className="py-3" data-followup>
      <p className="mb-1 text-xs text-brand-muted">
        {f.authorName ?? "Administració"} · {formatDate(f.createdAt)}
        {f.updatedAt !== f.createdAt && <> · editat el {formatDate(f.updatedAt)}</>}
      </p>
      {editing ? (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={f.id} />
          <TextAreaField label="Seguiment" name="body" required rows={3} maxLength={CLINICAL_MAX} defaultValue={f.body} />
          {state.error && <p className="text-sm text-error">{state.error}</p>}
          <div className="flex items-center gap-4">
            <SubmitButton>Desar</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}>
              Cancel·lar
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-brand-charcoal">{f.body}</p>
      )}
      {!editing && (canEdit || canDelete) && (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className={LINK}>
              Editar
            </button>
          )}
          {canDelete && (
            <ConfirmInline
              action={del}
              fields={{ id: f.id }}
              trigger="Esborrar"
              question="Esborrar aquest seguiment?"
              consequence="Desapareix de l'historial i no es pot recuperar."
              confirmLabel="Sí, esborra"
              pendingLabel="Esborrant…"
              pending={deleting}
              compact
            />
          )}
          {delState.error && <span className="text-xs text-error">{delState.error}</span>}
        </div>
      )}
    </li>
  );
}
