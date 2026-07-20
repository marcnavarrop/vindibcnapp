"use client";

import { useTransition } from "react";
import type { ClientDocument } from "@/lib/data/client-documents";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function fileIcon(mimeType: string | null): string {
  if (!mimeType) return "📄";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("word")) return "📝";
  return "📎";
}

export function DocumentsReadonlyPanel({
  documents,
}: {
  documents: ClientDocument[];
  clientId: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Documents
        </h2>
      </div>
      {documents.length === 0 ? (
        <p className="px-5 py-4 text-sm text-brand-muted">
          El client no ha pujat cap document.
        </p>
      ) : (
        <div className="divide-y divide-brand-border">
          {documents.map((doc) => (
            <ReadonlyDocumentRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReadonlyDocumentRow({ doc }: { doc: ClientDocument }) {
  const [isPending, startTransition] = useTransition();

  function handleDownload() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/client-documents/signed-url?id=${doc.id}`);
        if (!res.ok) throw new Error();
        const { url } = await res.json() as { url: string };
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName;
        a.target = "_blank";
        a.click();
      } catch {
        alert("No s'ha pogut descarregar el document.");
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
          {formatDate(doc.uploadedAt)}
          {doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isPending}
        className="ml-auto text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange disabled:opacity-50"
      >
        {isPending ? "…" : "Descarregar"}
      </button>
    </div>
  );
}
