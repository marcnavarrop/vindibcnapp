"use client";

import { useActionState, useState, useRef, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/labels";
import type { Locale } from "@/lib/i18n/config";
import type { ClientDocument } from "@/lib/data/client-documents";
import type { DocFormState } from "@/app/(client)/client/documents/actions";

const MAX_MB = 15;
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "heic", "heif", "doc", "docx"];
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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
  uploadAction,
  deleteAction,
}: {
  documents: ClientDocument[];
  uploadAction: (prev: DocFormState, formData: FormData) => Promise<DocFormState>;
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
  const [uploadState, uploadFormAction, uploading] = useActionState(
    async (prev: DocFormState, formData: FormData) => {
      const result = await uploadAction(prev, formData);
      if (result.ok) {
        setShowForm(false);
        // Reload page to show updated list.
        window.location.reload();
      }
      return result;
    },
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setClientError("tooBig");
      e.target.value = "";
      return;
    }
    if (!ALLOWED_MIME.has(file.type)) {
      setClientError("badFormat");
      e.target.value = "";
      return;
    }
    setClientError(null);
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
              className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
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
          <form ref={formRef} action={uploadFormAction} className="flex flex-col gap-3">
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
            {uploadState.errorCode && (
              <p className="text-sm text-error">
                {te(uploadState.errorCode, { max: MAX_MB })}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={uploading || !!clientError}
                className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold text-white hover:bg-brand-purple-light disabled:opacity-50"
              >
                {uploading ? t("uploading") : t("upload")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setClientError(null);
                }}
                className="rounded-lg border border-brand-border px-4 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
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
  const [confirming, setConfirming] = useState(false);
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

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-muted">{t("sure")}</span>
          <form action={deleteFormAction}>
            <input type="hidden" name="documentId" value={doc.id} />
            <button
              type="submit"
              disabled={deleting}
              className="rounded-md bg-error px-2 py-1 text-xs font-bold text-white hover:opacity-80 disabled:opacity-50"
            >
              {t("yes")}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md border border-brand-border px-2 py-1 text-xs font-bold text-brand-muted hover:text-brand-dark"
          >
            {t("no")}
          </button>
          {deleteState.errorCode && (
            <span className="text-xs text-error">
              {te(deleteState.errorCode!)}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isPending}
            className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange disabled:opacity-50"
          >
            {isPending ? "…" : t("download")}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs font-bold tracking-wide text-error uppercase hover:opacity-70"
          >
            {t("delete")}
          </button>
        </div>
      )}
    </div>
  );
}
