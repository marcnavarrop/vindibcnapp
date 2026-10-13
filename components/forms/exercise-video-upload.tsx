"use client";

import { useEffect, useRef, useState } from "react";
import { requestExerciseVideoUploadAction } from "@/lib/actions/exercise-actions";
import {
  checkExerciseVideo,
  videoMimeOf,
  MAX_VIDEO_MB,
  VIDEO_LIMIT_LABEL,
  VIDEO_RECORDING_TIP,
} from "@/lib/exercise-video.constants";

/**
 * Estat de la pujada, el que necessita saber el formulari per deixar desar o no.
 * - `idle`: no s'ha triat cap fitxer nou.
 * - `uploading`: s'està pujant (amb `progress`, 0–100).
 * - `done`: és a Storage; el camí va en un camp ocult (`uploadedVideoPath`).
 * - `error`: no s'ha pogut; `error` diu per què.
 */
export type VideoUploadStatus =
  | { state: "idle" }
  | { state: "uploading"; progress: number }
  | { state: "done" }
  | { state: "error"; error: string };

/**
 * El camp del vídeo d'un exercici: tria, comprova i PUJA el fitxer en aquell
 * moment, directament a Supabase Storage, sense passar per Vercel.
 *
 * Es puja en triar-lo i no en desar perquè la barra avanci mentre la persona
 * acaba d'omplir la resta del formulari. Si el canvia o se'n va sense desar,
 * el fitxer es queda a `pending/` i el cron l'esborra l'endemà
 * (`cleanupPendingExerciseVideos`).
 *
 * La pujada va amb XMLHttpRequest i no amb `uploadToSignedUrl` de supabase-js:
 * `fetch` no diu quant porta pujat, i sense barra de progrés un vídeo de 30 MB
 * en 4G sembla penjat.
 */
export function ExerciseVideoUpload({
  existingPath,
  inputRef,
  onStatus,
}: {
  existingPath: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onStatus: (status: VideoUploadStatus) => void;
}) {
  const [status, setStatusState] = useState<VideoUploadStatus>({ state: "idle" });
  const [path, setPath] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  // Cada fitxer triat té el seu torn: una resposta d'un fitxer anterior que
  // arribi tard no ha de trepitjar l'estat del nou.
  const turn = useRef(0);

  function setStatus(s: VideoUploadStatus) {
    setStatusState(s);
    onStatus(s);
  }

  // Si el camp desapareix (s'ha canviat a «Sense vídeo» o «Enllaç»), la
  // pujada en curs es talla: ja no la desarà ningú.
  useEffect(() => () => xhrRef.current?.abort(), []);

  async function start(file: File) {
    const myTurn = ++turn.current;
    xhrRef.current?.abort();
    setPath(null);

    const type = videoMimeOf(file);
    const check = checkExerciseVideo({ size: file.size, type });
    if (!check.ok) return setStatus({ state: "error", error: check.error });

    setStatus({ state: "uploading", progress: 0 });
    const res = await requestExerciseVideoUploadAction({ name: file.name, size: file.size, type }).catch(
      () => ({ ok: false as const, error: "No s'ha pogut connectar amb el servidor. Torna-ho a provar." }),
    );
    if (myTurn !== turn.current) return;
    if (!res.ok) return setStatus({ state: "error", error: res.error });

    // Simulació: no hi ha Storage. Es fa avançar la barra perquè la pantalla
    // es vegi com de debò.
    if (!res.upload.signedUrl) {
      setStatus({ state: "uploading", progress: 60 });
      await new Promise((r) => setTimeout(r, 300));
      if (myTurn !== turn.current) return;
      setPath(res.upload.path);
      return setStatus({ state: "done" });
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", res.upload.signedUrl);
    xhr.setRequestHeader("content-type", type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => {
      if (myTurn !== turn.current || !e.lengthComputable) return;
      setStatus({ state: "uploading", progress: Math.min(99, Math.round((e.loaded / e.total) * 100)) });
    };
    xhr.onload = () => {
      if (myTurn !== turn.current) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        setPath(res.upload.path);
        return setStatus({ state: "done" });
      }
      setStatus({ state: "error", error: uploadErrorText(xhr.status, xhr.responseText) });
    };
    xhr.onerror = () => {
      if (myTurn !== turn.current) return;
      setStatus({
        state: "error",
        error: "La pujada s'ha tallat (sense connexió o connexió inestable). Torna a triar el vídeo per reintentar-ho.",
      });
    };
    xhr.send(file);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Si ja hi ha un vídeo i no se'n tria cap de nou, es conserva. */}
      {existingPath && (
        <input type="hidden" name="existingVideoFilePath" value={existingPath} />
      )}
      {/* El vídeo nou ja pujat: només el camí viatja amb el formulari. */}
      {path && <input type="hidden" name="uploadedVideoPath" value={path} />}

      <label htmlFor="exercise-video-file" className="text-xs font-bold tracking-wide text-brand-muted uppercase">
        Fitxer de vídeo ({VIDEO_LIMIT_LABEL})
      </label>
      {existingPath && (
        <p className="rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-muted">
          Ja hi ha un vídeo pujat. Selecciona un fitxer nou per substituir-lo, o deixa-ho en blanc
          per conservar-lo.
        </p>
      )}
      {/* Sense `name`: el fitxer no viatja amb el formulari (Vercel el tallaria
          a 4,5 MB), sinó que es puja a part. Sense `capture`: a l'iPhone obria
          directament la càmera i no deixava triar un vídeo de la galeria. */}
      <input
        id="exercise-video-file"
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        ref={inputRef}
        aria-describedby="exercise-video-tip"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) {
            turn.current++;
            xhrRef.current?.abort();
            setPath(null);
            return setStatus({ state: "idle" });
          }
          void start(f);
        }}
        className="text-sm text-brand-dark file:mr-3 file:rounded-lg file:border-0 file:bg-brand-purple file:px-3 file:py-1 file:text-xs file:font-bold file:tracking-wide file:text-white file:uppercase"
      />
      <p id="exercise-video-tip" className="text-xs text-brand-muted">
        {VIDEO_RECORDING_TIP} Si no, posa&apos;l a YouTube (ocult) i tria «Enllaç».
      </p>

      {status.state === "uploading" && (
        <div className="flex flex-col gap-1" role="status" aria-live="polite">
          <div
            className="h-2 overflow-hidden rounded-full bg-brand-border"
            role="progressbar"
            aria-label="Pujada del vídeo"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={status.progress}
          >
            <div
              className="h-full rounded-full bg-brand-purple transition-[width]"
              style={{ width: `${status.progress}%` }}
            />
          </div>
          <p className="text-xs text-brand-muted">Pujant el vídeo… {status.progress}%</p>
        </div>
      )}
      {status.state === "done" && (
        <p className="text-sm text-success" role="status">
          ✓ Vídeo pujat. Ja pots desar l&apos;exercici.
        </p>
      )}
      {status.state === "error" && (
        <p className="text-sm text-error" role="alert">
          {status.error}
        </p>
      )}
    </div>
  );
}

/** Què ha passat, en paraules, segons la resposta de Storage. */
function uploadErrorText(status: number, body: string): string {
  if (status === 413 || /maximum allowed size|too large|payload/i.test(body))
    return `El vídeo és més gran del que admet l'emmagatzematge (${MAX_VIDEO_MB} MB). Grava'l en 1080p i més curt, o posa un enllaç de YouTube.`;
  if (/mime|content type|not supported/i.test(body)) return "Format no acceptat. Usa MP4 o MOV.";
  if (status === 400 || status === 403)
    return "El permís de pujada ha caducat o ja s'ha fet servir. Torna a triar el vídeo.";
  return `No s'ha pogut pujar el vídeo (error ${status}). Torna-ho a provar.`;
}
