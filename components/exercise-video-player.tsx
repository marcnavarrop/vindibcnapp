"use client";

import { useState } from "react";

/**
 * Mostra el vídeo d'un exercici: si hi ha videoUrl, un enllaç extern;
 * si hi ha videoFilePath, un <video> natiu via signed URL.
 *
 * La signed URL NO es demana en muntar-se: una biblioteca de 30 exercicis
 * dispararia 30 peticions a Storage només obrint la pàgina, i la majoria de
 * vídeos no s'arriben a reproduir mai. Es demana al primer clic, i llavors es
 * munta el <video> ja reproduint, de manera que un sol clic basta.
 */

/** Portada de marca (SVG inline) perquè no es vegi una caixa negra buida. */
const POSTER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
       <rect width="320" height="180" fill="#642263"/>
       <circle cx="160" cy="90" r="34" fill="#ffffff" fill-opacity="0.14"/>
       <path d="M150 74l30 16-30 16z" fill="#ffffff" fill-opacity="0.85"/>
     </svg>`,
  );

/** Mateixa caixa per al placeholder i per al vídeo: evita salts de maquetació. */
const BOX = "mt-1 w-full max-w-sm rounded-lg";

/**
 * Els textos, opcionals i amb el català per defecte.
 *
 * Aquest reproductor surt a la fitxa de client de l'admin i del professional,
 * que van en català fix, i també a l'àrea de client, que es tradueix. Les
 * cadenes arriben com a dades des de qui el fa servir: així cada banda mana
 * sobre el seu idioma sense que el component hagi de saber on és.
 */
export type VideoTexts = {
  watch: string;
  loading: string;
  error: string;
  play: string;
  retry: string;
};

const CA: VideoTexts = {
  watch: "▶ Veure vídeo",
  loading: "Carregant…",
  error: "No s'ha pogut carregar el vídeo. Torna-ho a provar.",
  play: "Reproduir el vídeo",
  retry: "Reintentar carregar el vídeo",
};

export function ExerciseVideoPlayer({
  videoUrl,
  videoFilePath,
  texts = CA,
}: {
  videoUrl?: string | null;
  videoFilePath?: string | null;
  texts?: VideoTexts;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadVideo() {
    if (!videoFilePath || loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/exercise-videos/signed-url?path=${encodeURIComponent(videoFilePath)}`,
      );
      const data = (await res.json()) as { url?: string };
      if (data.url) setSignedUrl(data.url);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (videoUrl) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-bold text-brand-purple hover:text-brand-orange"
      >
        {texts.watch}
      </a>
    );
  }

  if (!videoFilePath) return null;

  // Un cop demanada la URL, el vídeo es munta ja reproduint: el clic del
  // placeholder val com el "play", sense obligar l'usuari a clicar dues vegades.
  if (signedUrl) {
    return (
      <video
        src={signedUrl}
        poster={POSTER}
        controls
        autoPlay
        playsInline
        preload="none"
        className={`${BOX} aspect-video bg-brand-dark`}
      />
    );
  }

  return (
    <div className={BOX}>
      <button
        type="button"
        onClick={loadVideo}
        disabled={loading}
        aria-label={error ? texts.retry : texts.play}
        className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-brand-purple transition-opacity hover:opacity-95 disabled:cursor-wait"
      >
        <span className="absolute inset-0 flex items-center justify-center">
          {loading ? (
            <span className="text-xs font-bold text-white/90">{texts.loading}</span>
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:scale-110">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="ml-1 h-7 w-7 text-white/90"
              >
                <path d="M8 5l12 7-12 7z" />
              </svg>
            </span>
          )}
        </span>
      </button>
      {error && (
        <p className="mt-1 text-xs text-error">
          {texts.error}
        </p>
      )}
    </div>
  );
}
