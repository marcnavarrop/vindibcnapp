"use client";

import { useTransition } from "react";
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

export function VideosReadonlyPanel({ videos }: { videos: ClientVideo[] }) {
  if (videos.length === 0) {
    return (
      <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
        <div className="border-b border-brand-border bg-brand-bg px-5 py-3">
          <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
            Vídeos del professional
          </h2>
        </div>
        <p className="px-5 py-4 text-sm text-brand-muted">
          El teu professional no ha pujat cap vídeo per a tu encara.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Vídeos del professional
        </h2>
      </div>
      <div className="divide-y divide-brand-border">
        {videos.map((v) => (
          <VideoItem key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}

function VideoItem({ video }: { video: ClientVideo }) {
  const [isPending, startTransition] = useTransition();

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
