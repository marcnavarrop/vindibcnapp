"use client";

import { ConfirmInline } from "@/components/ui/confirm-inline";
import { TAP } from "@/lib/utils";
import { useActionState, useState, useRef, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { ClientDocument } from "@/lib/data/client-documents";
import type { DocFormState } from "@/app/(client)/client/documents/actions";
import type { DocErrorCode } from "@/app/(client)/client/documents/actions";
import {
  DOCUMENT_MAX_MB as MAX_MB,
  DOCUMENT_ALLOWED_EXT as ALLOWED_EXT,
  checkDocument,
  documentMimeOf,
} from "@/lib/documents";
import { USE_MOCK } from "@/lib/config";

/** Errors de la pujada al navegador, a més dels de l'acció. */
type UploadErrorCode = DocErrorCode | "interrupted" | "uploadDenied";

/**
 * Puja el fitxer directament a Supabase Storage AMB LA SESSIÓ DEL CLIENT.
 *
 * No passa per Vercel (que talla a 4,5 MB; el límit és de 15): la RLS de
 * Storage de la 0025 només el deixa escriure a la seva carpeta, i és qui
 * mana. Amb XMLHttpRequest i no amb supabase-js per poder ensenyar el progrés.
 */
async function uploadToStorage(
  path: string,
  file: File,
  type: string,
  onProgress: (pct: number) => void,
): Promise<UploadErrorCode | null> {
  // Import dinàmic, com al login: supabase-js no entra a la càrrega inicial.
  const { createClient } = await import("@/lib/supabase/client");
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return "unauthenticated";
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/client-documents/${path}`);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("content-type", type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(null);
      const body = xhr.responseText;
      if (xhr.status === 413 || /maximum allowed size|too large/i.test(body)) return resolve("tooBig");
      if (/mime|not supported/i.test(body)) return resolve("badFormat");
      if (xhr.status === 401 || /jwt|expired/i.test(body)) return resolve("unauthenticated");
      if (xhr.status === 403 || /row-level security|unauthorized/i.test(body)) return resolve("uploadDenied");
      resolve("uploadFailed");
    };
    xhr.onerror = () => resolve("interrupted");
    xhr.send(file);
  });
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mimeType: string | null): string {
  if (!mimeType) return "📄";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("word")) return "📝";
  return "📎";
}

export function DocumentsClientPanel({
  documents,
  prepareAction,
  registerAction,
  deleteAction,
}: {
  documents: ClientDocument[];
  prepareAction: (file: { size: number; type: string }) => Promise<{ ok: true; path: string } | { ok: false; errorCode: DocErrorCode }>;
  registerAction: (input: { path: string; fileName: string; description?: string; size?: number; type?: string }) => Promise<DocFormState>;
  deleteAction: (prev: DocFormState, formData: FormData) => Promise<DocFormState>;
}) {
  const t = useTranslations("documents");
  const te = useTranslations("documents.errors");
  const [showForm, setShowForm] = useState(documents.length === 0);
  // El codi, no la frase: així el missatge es tradueix on es pinta i no cal
  // recalcular-lo si algú canvia d'idioma amb el formulari obert.
  const [clientError, setClientError] = useState<
    "tooBig" | "badFormat" | null
  >(null);
  // La pujada: progrés (0–100) mentre dura, i l'error si n'hi ha.
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<UploadErrorCode | null>(null);
  const uploading = progress !== null;
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return setClientError(null);
    const check = checkDocument({ size: file.size, type: documentMimeOf(file) });
    if (!check.ok) {
      setClientError(check.code);
      e.target.value = "";
      return;
    }
    setClientError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return setUploadError("noFile");
    const type = documentMimeOf(file);
    const description = String(fd.get("description") ?? "");
    setUploadError(null);
    setProgress(0);
    try {
      const prep = await prepareAction({ size: file.size, type });
      if (!prep.ok) return setUploadError(prep.errorCode);
      if (!USE_MOCK) {
        const err = await uploadToStorage(prep.path, file, type, setProgress);
        if (err) return setUploadError(err);
      }
      setProgress(100);
      const reg = await registerAction({ path: prep.path, fileName: file.name, description, size: file.size, type });
      if (reg.errorCode) return setUploadError(reg.errorCode);
      setShowForm(false);
      window.location.reload();
    } catch {
      setUploadError("interrupted");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Llista de documents */}
      <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
        <div className="flex items-center justify-between border-b border-brand-border bg-brand-bg px-5 py-3">
          <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
            {t("mine")}
          </h2>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline active:opacity-70 ${TAP}`}
            >
              {t("add")}
            </button>
          )}
        </div>

        {documents.length === 0 && !showForm ? (
          <p className="px-5 py-4 text-sm text-brand-muted">
            {t("empty")}
          </p>
        ) : (
          <div className="divide-y divide-brand-border">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                deleteAction={deleteAction}
              />
            ))}
          </div>
        )}
      </section>

      {/* Formulari d'upload */}
      {showForm && (
        <section className="rounded-2xl border border-brand-border bg-white p-5">
          <h2 className="mb-4 text-sm font-bold tracking-wide text-brand-muted uppercase">
            {t("newTitle")}
          </h2>
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold tracking-wide text-brand-muted uppercase">
                {t("file")} <span className="text-error">*</span>
              </label>
              <input
                type="file"
                name="file"
                required
                // La llista d'extensions ja existia a `ALLOWED_EXT`: fins ara
                // es tornava a escriure aquí i podien acabar dient coses
                // diferents.
                accept={ALLOWED_EXT.map((e) => `.${e}`).join(",")}
                onChange={handleFileChange}
                className="block w-full text-sm text-brand-charcoal file:mr-3 file:rounded-lg file:border file:border-brand-border file:bg-brand-bg file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-brand-charcoal hover:file:bg-white"
              />
              <p className="mt-1 text-xs text-brand-muted">
                {t("fileHint", { max: MAX_MB })}
              </p>
              {clientError && (
                <p className="mt-1 text-xs text-error">
                  {te(clientError, { max: MAX_MB })}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold tracking-wide text-brand-muted uppercase">
                {t("description")}
              </label>
              <input
                type="text"
                name="description"
                placeholder={t("descriptionPlaceholder")}
                maxLength={200}
                className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
            </div>
            {uploading && (
              <div className="flex flex-col gap-1" role="status" aria-live="polite">
                <div
                  className="h-2 overflow-hidden rounded-full bg-brand-border"
                  role="progressbar"
                  aria-label={t("uploading")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div className="h-full rounded-full bg-brand-purple transition-[width]" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-brand-muted">{t("uploadingPct", { pct: progress })}</p>
              </div>
            )}
            {uploadError && (
              <p className="text-sm text-error" role="alert">
                {te(uploadError, { max: MAX_MB })}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={uploading || !!clientError}
                className={`rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-50 active:bg-brand-purple-dark ${TAP}`}
              >
                {uploading ? t("uploading") : t("upload")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setClientError(null);
                }}
                className={`rounded-lg border border-brand-border px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark active:bg-brand-bg ${TAP}`}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  deleteAction,
}: {
  doc: ClientDocument;
  deleteAction: (prev: DocFormState, formData: FormData) => Promise<DocFormState>;
}) {
  const t = useTranslations("documents");
  const te = useTranslations("documents.errors");
  const locale = useLocale() as Locale;
  const [deleteState, deleteFormAction, deleting] = useActionState(
    async (prev: DocFormState, formData: FormData) => {
      const result = await deleteAction(prev, formData);
      if (result.ok) window.location.reload();
      return result;
    },
    {},
  );
  const [isPending, startTransition] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/client-documents/signed-url?id=${doc.id}`);
        if (!res.ok) throw new Error("signed-url");
        const { url } = await res.json() as { url: string };
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName;
        a.target = "_blank";
        a.click();
      } catch {
        alert(t("downloadFailed"));
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
      <span className="text-base">{fileIcon(doc.mimeType)}</span>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-bold text-brand-dark">{doc.fileName}</span>
        {doc.description && (
          <span className="block text-xs text-brand-muted">{doc.description}</span>
        )}
        <span className="block text-xs text-brand-muted">
          {formatDate(doc.uploadedAt, locale)}
          {doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={isPending}
          className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline disabled:opacity-50 active:opacity-70 ${TAP}`}
        >
          {isPending ? "…" : t("download")}
        </button>
        <ConfirmInline
          compact
          action={deleteFormAction}
          fields={{ documentId: doc.id }}
          pending={deleting || undefined}
          trigger={t("delete")}
          triggerClassName={`text-xs font-bold tracking-wide text-error uppercase hover:opacity-70 active:opacity-50 ${TAP}`}
          question={t("deleteQuestion", { name: doc.fileName })}
          consequence={t("deleteConsequence")}
          confirmLabel={t("deleteYes")}
          pendingLabel={t("deleting")}
          backLabel={t("deleteBack")}
        />
      </div>
      {deleteState.errorCode && (
        <span className="w-full text-right text-xs text-error">
          {te(deleteState.errorCode!)}
        </span>
      )}
    </div>
  );
}
