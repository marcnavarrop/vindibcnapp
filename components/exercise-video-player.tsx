"use client";

import { useEffect, useState } from "react";

/**
 * Mostra el vídeo d'un exercici: si hi ha videoUrl, un enllaç extern;
 * si hi ha videoFilePath, un <video> natiu via signed URL.
 */
export function ExerciseVideoPlayer({
  videoUrl,
  videoFilePath,
}: {
  videoUrl?: string | null;
  videoFilePath?: string | null;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!videoFilePath) return;
    fetch(`/api/exercise-videos/signed-url?path=${encodeURIComponent(videoFilePath)}`)
      .then((r) => r.json())
      .then((d: { url?: string }) => {
        if (d.url) setSignedUrl(d.url);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [videoFilePath]);

  if (videoUrl) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-bold text-brand-purple hover:text-brand-orange"
      >
        ▶ Veure vídeo
      </a>
    );
  }

  if (videoFilePath) {
    if (error) {
      return (
        <p className="text-xs text-brand-muted">
          No s&apos;ha pogut carregar el vídeo.
        </p>
      );
    }
    if (!signedUrl) {
      return (
        <p className="text-xs text-brand-muted animate-pulse">
          Carregant vídeo…
        </p>
      );
    }
    return (
      <video
        src={signedUrl}
        controls
        playsInline
        className="mt-1 w-full max-w-sm rounded-lg"
        style={{ maxHeight: "240px" }}
      />
    );
  }

  return null;
}
