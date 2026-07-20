"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { ClientVideo } from "@/lib/data/client-videos";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
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

type UploadState = { error?: string; ok?: boolean };

export function VideosUploaderPanel({
  videos,
  uploadAction,
  deleteAction,
}: {
  videos: ClientVideo[];
  uploadAction: (prev: UploadState, fd: FormData) => Promise<UploadState>;
  deleteAction: (prev: UploadState, fd: FormData) => Promise<UploadState>;
}) {
  const [uploadState, uploadFormAction] = useActionState(uploadAction, {});
  const fileRef = useRef<HTMLInputElement>(null);

  function handleUploadSuccess() {
    if (uploadState.ok) window.location.reload();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Vídeos del professional
        </h2>
      </div>

      {/* Formulari d'upload */}
      <form
        action={uploadFormAction}
        onSubmit={() => setTimeout(() => window.location.reload(), 300)}
        className="border-b border-brand-border px-5 py-4"
      >
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            Pujar vídeo nou (MP4 / MOV, màx. 200 MB)
          </label>
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            required
            className="text-sm text-brand-dark file:mr-3 file:rounded-lg file:border-0 file:bg-brand-purple file:px-3 file:py-1 file:text-xs file:font-bold file:text-white file:tracking-wide file:uppercase"
          />
          <input
            type="text"
            name="description"
            placeholder="Descripció breu (opcional)"
            className="rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-dark placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-purple"
          />
          {uploadState.error && (
            <p className="text-xs text-error">{uploadState.error}</p>
          )}
          <button
            type="submit"
            className="self-start rounded-lg bg-brand-purple px-4 py-2 text-xs font-bold tracking-wide text-white uppercase hover:opacity-90"
          >
            Pujar vídeo
          </button>
        </div>
      </form>

      {/* Llistat */}
      {videos.length === 0 ? (
        <p className="px-5 py-4 text-sm text-brand-muted">
          Encara no hi ha cap vídeo pujat.
        </p>
      ) : (
        <div className="divide-y divide-brand-border">
          {videos.map((v) => (
            <VideoRow key={v.id} video={v} deleteAction={deleteAction} />
          ))}
        </div>
      )}
    </section>
  );
}

function VideoRow({
  video,
  deleteAction,
}: {
  video: ClientVideo;
  deleteAction: (prev: UploadState, fd: FormData) => Promise<UploadState>;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [, deleteFormAction] = useActionState(deleteAction, {});

  function handleDownload() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/client-videos/signed-url?id=${video.id}`);
        if (!res.ok) throw new Error();
        const { url } = (await res.json()) as { url: string };
        const a = document.createElement("a");
        a.href = url;
        a.download = video.fileName;
        a.target = "_blank";
        a.click();
      } catch {
        alert("No s'ha pogut descarregar el vídeo.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
      <span className="text-base">🎬</span>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-bold text-brand-dark">
          {video.fileName}
        </span>
        {video.description && (
          <span className="block text-xs text-brand-muted">
            {video.description}
          </span>
        )}
        <span className="block text-xs text-brand-muted">
          {formatDate(video.uploadedAt)}
          {video.fileSize ? ` · ${formatBytes(video.fileSize)}` : ""}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={isPending}
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange disabled:opacity-50"
        >
          {isPending ? "…" : "Descarregar"}
        </button>
        {confirming ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-brand-dark">Eliminar?</span>
            <form action={deleteFormAction} onSubmit={() => setTimeout(() => window.location.reload(), 200)}>
              <input type="hidden" name="videoId" value={video.id} />
              <button
                type="submit"
                className="font-bold text-error hover:underline"
              >
                Sí
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="font-bold text-brand-muted hover:underline"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
