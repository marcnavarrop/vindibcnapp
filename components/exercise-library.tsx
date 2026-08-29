"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Film, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { normalizeForSearch, clsx } from "@/lib/utils";
import type { Exercise } from "@/lib/data/exercises";
import type { ExerciseCategoryItem } from "@/lib/data/exercise-categories";

/**
 * El banc d'exercicis, compartit per l'admin i el professional.
 *
 * Les fitxes són compactes a posta. Abans cada una muntava el reproductor
 * sencer —una caixa 16:9— tingués vídeo o no, i la biblioteca creixia tant en
 * vertical que buscar-hi res obligava a desplaçar-se molt. Ara el vídeo es
 * redueix a una icona que diu QUINA mena de vídeo és, i es mira en un diàleg.
 * Totes les fitxes fan si fa no fa la mateixa alçada.
 */

// ─── Quina mena de vídeo porta ───────────────────────────────────────────────

type VideoKind = "file" | "youtube" | "external" | "none";

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (!u.hostname.replace(/^www\./, "").endsWith("youtube.com")) return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    if (u.pathname.startsWith("/embed/")) return u.pathname.slice(7) || null;
    return null;
  } catch {
    return null;
  }
}

function videoKind(e: Exercise): VideoKind {
  if (e.videoFilePath) return "file";
  if (e.videoUrl) return youtubeId(e.videoUrl) ? "youtube" : "external";
  return "none";
}

/** El logo de YouTube: lucide ja no porta icones de marca. */
function YouTubeMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#FF0000"
        d="M23.5 6.5a3 3 0 00-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 00.5 6.5C0 8.4 0 12 0 12s0 3.6.5 5.5a3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1c.5-1.9.5-5.5.5-5.5s0-3.6-.5-5.5z"
      />
      <path fill="#fff" d="M9.6 15.6l6.3-3.6-6.3-3.6z" />
    </svg>
  );
}

// ─── Component principal ─────────────────────────────────────────────────────

export function ExerciseLibrary({
  exercises,
  categories,
  basePath,
  deleteAction,
}: {
  exercises: Exercise[];
  categories: ExerciseCategoryItem[];
  /** "/admin/exercicis" o "/trainer/exercicis". */
  basePath: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [playing, setPlaying] = useState<Exercise | null>(null);

  const ordered = useMemo(
    () => [...exercises].sort((a, b) => a.name.localeCompare(b.name, "ca")),
    [exercises],
  );

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    return ordered.filter((e) => {
      if (categoryId !== "all" && e.categoryId !== categoryId) return false;
      if (!q) return true;
      // També per descripció: molts exercicis es recorden pel que treballen
      // ("rotació externa"), no pel nom exacte que se'ls va posar.
      return (
        normalizeForSearch(e.name).includes(q) ||
        normalizeForSearch(e.description).includes(q)
      );
    });
  }, [ordered, query, categoryId]);

  const filtering = query.trim() !== "" || categoryId !== "all";

  return (
    <div className="flex flex-col gap-4">
      {/* ── Cerca i filtre ── */}
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nom o descripció…"
          aria-label="Cercar exercicis"
          className="w-full max-w-sm rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          <Chip
            active={categoryId === "all"}
            onClick={() => setCategoryId("all")}
            label="Totes"
            count={ordered.length}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
              label={c.name}
              count={c.exerciseCount}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-muted" aria-live="polite">
          {filtering
            ? `${filtered.length} de ${ordered.length} exercicis`
            : `${ordered.length} ${ordered.length === 1 ? "exercici" : "exercicis"}`}
        </p>
        <Link
          href={`${basePath}/categories`}
          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
        >
          Gestionar categories →
        </Link>
      </div>

      {/* ── Resultats ── */}
      {ordered.length === 0 ? (
        <Empty>Encara no hi ha exercicis. Crea&apos;n el primer.</Empty>
      ) : filtered.length === 0 ? (
        <Empty>
          Cap exercici coincideix amb la cerca.{" "}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategoryId("all");
            }}
            className="font-bold text-brand-purple underline hover:text-brand-orange"
          >
            Veure&apos;ls tots
          </button>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <ExerciseCard
              key={e.id}
              exercise={e}
              basePath={basePath}
              deleteAction={deleteAction}
              onPlay={() => setPlaying(e)}
            />
          ))}
        </div>
      )}

      {playing && (
        <VideoDialog exercise={playing} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}

// ─── Fitxa ───────────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise: e,
  basePath,
  deleteAction,
  onPlay,
}: {
  exercise: Exercise;
  basePath: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
  onPlay: () => void;
}) {
  const kind = videoKind(e);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base leading-tight font-bold text-brand-dark">
          {e.name}
        </h2>
        <Badge tone="info">{e.categoryName}</Badge>
      </div>

      {e.description && (
        // Dues línies i prou: una descripció llarga no pot decidir l'alçada de
        // tota la graella. El text sencer es veu en obrir l'exercici.
        <p className="line-clamp-2 text-sm text-brand-muted">{e.description}</p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-2">
        <VideoIndicator kind={kind} url={e.videoUrl} onPlay={onPlay} />

        <div className="ml-auto flex items-center gap-3">
          <Link
            href={`${basePath}/${e.id}/edit`}
            className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
          >
            Editar
          </Link>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={e.id} />
            <button
              type="submit"
              className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error"
            >
              Eliminar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function VideoIndicator({
  kind,
  url,
  onPlay,
}: {
  kind: VideoKind;
  url: string | null;
  onPlay: () => void;
}) {
  const box =
    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors";

  if (kind === "none")
    return <span className="text-xs text-brand-muted">Sense vídeo</span>;

  // Un enllaç que no és de YouTube no es pot encastar amb garanties: s'obre a
  // fora, que és el que ja feia abans.
  if (kind === "external")
    return (
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        title="Obrir el vídeo (enllaç extern)"
        aria-label="Obrir el vídeo en una pestanya nova"
        className={`${box} bg-brand-bg text-brand-muted hover:bg-brand-purple/10 hover:text-brand-purple`}
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    );

  return (
    <button
      type="button"
      onClick={onPlay}
      title={kind === "youtube" ? "Veure el vídeo de YouTube" : "Veure el vídeo"}
      aria-label="Veure el vídeo"
      className={`${box} ${
        kind === "youtube"
          ? "bg-white hover:bg-brand-bg"
          : "bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20"
      }`}
    >
      {kind === "youtube" ? (
        <YouTubeMark className="h-5 w-5" />
      ) : (
        <Film className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}

// ─── Diàleg del vídeo ────────────────────────────────────────────────────────

function VideoDialog({
  exercise: e,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const kind = videoKind(e);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // La signed URL es demana en obrir el diàleg i no en pintar la graella: una
  // biblioteca de trenta exercicis dispararia trenta peticions a Storage per
  // a vídeos que gairebé mai es reprodueixen. Mateix criteri que tenia el
  // reproductor inline.
  useEffect(() => {
    if (kind !== "file" || !e.videoFilePath) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/exercise-videos/signed-url?path=${encodeURIComponent(e.videoFilePath!)}`,
        );
        const data = (await res.json()) as { url?: string };
        if (!alive) return;
        if (data.url) setSignedUrl(data.url);
        else setError(true);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind, e.videoFilePath]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const ytId = e.videoUrl ? youtubeId(e.videoUrl) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/70 p-4">
      <button
        type="button"
        aria-label="Tancar"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={e.name}
        className="relative w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-brand-dark">{e.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tancar"
            className="rounded-lg p-1 text-brand-muted hover:bg-brand-bg hover:text-brand-dark"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {kind === "youtube" && ytId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}`}
            title={e.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full rounded-lg border-0 bg-brand-dark"
          />
        ) : signedUrl ? (
          <video
            src={signedUrl}
            controls
            autoPlay
            playsInline
            className="aspect-video w-full rounded-lg bg-brand-dark"
          />
        ) : error ? (
          <p className="rounded-lg bg-brand-bg px-4 py-8 text-center text-sm text-error">
            No s&apos;ha pogut carregar el vídeo. Torna-ho a provar.
          </p>
        ) : (
          <p className="rounded-lg bg-brand-bg px-4 py-8 text-center text-sm text-brand-muted">
            Carregant…
          </p>
        )}

        {e.description && (
          <p className="mt-3 text-sm text-brand-muted">{e.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Peces petites ───────────────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
        active
          ? "border-brand-purple bg-brand-purple text-white"
          : "border-brand-border bg-white text-brand-muted hover:border-brand-purple hover:text-brand-purple",
      )}
    >
      {label}
      <span className={clsx("ml-1.5", active ? "text-white/70" : "text-brand-border")}>
        {count}
      </span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-brand-border bg-white px-5 py-8 text-center text-sm text-brand-muted">
      {children}
    </p>
  );
}
