"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Film, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { normalizeForSearch, clsx, TAP } from "@/lib/utils";
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

/**
 * El mínim que necessiten l'indicador i el diàleg de vídeo.
 *
 * No demanen un `Exercise` sencer perquè els exercicis ASSIGNATS a un client
 * són un altre tipus —porten les notes del professional i l'id de
 * l'assignació— i han de poder ensenyar el vídeo igual. Amb aquesta forma
 * mínima, les dues seccions de la pantalla del client comparteixen la mateixa
 * icona i el mateix diàleg en comptes de tenir-ne cadascuna el seu.
 */
export type PlayableExercise = {
  name: string;
  description: string | null;
  videoUrl: string | null;
  videoFilePath: string | null;
};

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

export function videoKind(e: PlayableExercise): VideoKind {
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

/**
 * Els textos, ja resolts.
 *
 * La biblioteca la miren tres àrees: l'admin i el professional (que la
 * gestionen i van en català fix) i el client (que només la mira i sí que es
 * tradueix). Van com a dades i no com a crides a `useTranslations` perquè
 * només l'àrea de client té `NextIntlClientProvider` a sobre. Mateix
 * arranjament que al canvi de contrasenya i a les preferències d'avisos.
 */
export type LibraryTexts = {
  search: string;
  searchAria: string;
  all: string;
  countFiltered: (shown: number, total: number) => string;
  countTotal: (n: number) => string;
  empty: string;
  noMatch: string;
  seeAll: string;
  noVideo: string;
  watch: string;
  watchYoutube: string;
  openExternal: string;
  openExternalAria: string;
  close: string;
  loading: string;
  videoError: string;
};

const CA: LibraryTexts = {
  search: "Cerca per nom o descripció…",
  searchAria: "Cercar exercicis",
  all: "Totes",
  countFiltered: (shown, total) => `${shown} de ${total} exercicis`,
  countTotal: (n) => `${n} ${n === 1 ? "exercici" : "exercicis"}`,
  empty: "Encara no hi ha exercicis.",
  noMatch: "Cap exercici coincideix amb la cerca.",
  seeAll: "Veure'ls tots",
  noVideo: "Sense vídeo",
  watch: "Veure el vídeo",
  watchYoutube: "Veure el vídeo de YouTube",
  openExternal: "Obrir el vídeo (enllaç extern)",
  openExternalAria: "Obrir el vídeo en una pestanya nova",
  close: "Tancar",
  loading: "Carregant…",
  videoError: "No s'ha pogut carregar el vídeo. Torna-ho a provar.",
};

/**
 * La biblioteca de l'àrea de CLIENT: només lectura i traduïda.
 *
 * És un embolcall i no un `texts` que arribi des de la pàgina perquè els
 * comptadors porten plural ("1 exercici" / "5 exercicis") i això és una funció
 * del nombre, no una cadena; i una funció no es pot passar d'un component de
 * servidor a un de client. Aquí, que ja som al client i dins del proveïdor
 * d'idioma, es pot cridar el hook i construir-la.
 */
export function ClientExerciseLibrary({
  exercises,
  categories,
}: {
  exercises: Exercise[];
  categories: ExerciseCategoryItem[];
}) {
  const t = useTranslations("workouts.lib");
  return (
    <ExerciseLibrary
      exercises={exercises}
      categories={categories}
      texts={{
        search: t("search"),
        searchAria: t("searchAria"),
        all: t("all"),
        countFiltered: (shown, total) => t("countFiltered", { shown, total }),
        countTotal: (count) => t("countTotal", { count }),
        empty: t("empty"),
        noMatch: t("noMatch"),
        seeAll: t("seeAll"),
        noVideo: t("noVideo"),
        watch: t("watch"),
        watchYoutube: t("watchYoutube"),
        openExternal: t("openExternal"),
        openExternalAria: t("openExternalAria"),
        close: t("close"),
        loading: t("loading"),
        videoError: t("videoError"),
      }}
    />
  );
}

// ─── Component principal ─────────────────────────────────────────────────────

export function ExerciseLibrary({
  exercises,
  categories,
  basePath,
  deleteAction,
  texts = CA,
}: {
  exercises: Exercise[];
  categories: ExerciseCategoryItem[];
  /**
   * "/admin/exercicis" o "/trainer/exercicis". Sense `basePath` la biblioteca
   * entra en mode LECTURA: sense editar, sense esborrar i sense l'enllaç a
   * les categories. És el que veu el client, que no en gestiona cap.
   */
  basePath?: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  /** Sense res, català: l'admin i el professional no es tradueixen. */
  texts?: LibraryTexts;
}) {
  const manage = Boolean(basePath && deleteAction);
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

  /*
   * El recompte de cada xip surt dels exercicis que ES VEUEN, no del que diu
   * `exerciseCount`. A l'admin donen el mateix —hi són tots—, però el client
   * només veu els que no té assignats, i el número que ve de la base diria una
   * xifra que no correspon a res del que hi ha a la pantalla.
   */
  const countByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of ordered)
      m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + 1);
    return m;
  }, [ordered]);

  const filtering = query.trim() !== "" || categoryId !== "all";

  return (
    <div className="flex flex-col gap-4">
      {/* ── Cerca i filtre ── */}
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={texts.search}
          aria-label={texts.searchAria}
          className="w-full max-w-sm rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          <Chip
            active={categoryId === "all"}
            onClick={() => setCategoryId("all")}
            label={texts.all}
            count={ordered.length}
          />
          {categories
            .filter(
              // Un xip a zero no porta enlloc. A qui gestiona la biblioteca sí
              // que li diu alguna cosa —la categoria existeix i està buida—,
              // però a qui només la mira és un carreró sense sortida.
              (c) => manage || (countByCategory.get(c.id) ?? 0) > 0,
            )
            .map((c) => (
              <Chip
                key={c.id}
                active={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                label={c.name}
                count={countByCategory.get(c.id) ?? 0}
              />
            ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-muted" aria-live="polite">
          {filtering
            ? texts.countFiltered(filtered.length, ordered.length)
            : texts.countTotal(ordered.length)}
        </p>
        {/* Gestionar categories és cosa de qui les manté, no de qui les mira. */}
        {manage && (
          <Link
            href={`${basePath}/categories`}
            className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
          >
            Gestionar categories →
          </Link>
        )}
      </div>

      {/* ── Resultats ── */}
      {ordered.length === 0 ? (
        <Empty>
          {texts.empty}
          {manage ? " Crea\u0027n el primer." : ""}
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty>
          {texts.noMatch}{" "}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategoryId("all");
            }}
            className={`font-bold text-brand-purple underline hover:text-brand-orange active:opacity-70 ${TAP}`}
          >
            {texts.seeAll}
          </button>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <ExerciseCard
              key={e.id}
              exercise={e}
              basePath={manage ? basePath : undefined}
              deleteAction={manage ? deleteAction : undefined}
              texts={texts}
              onPlay={() => setPlaying(e)}
            />
          ))}
        </div>
      )}

      {playing && (
        <VideoDialog
          exercise={playing}
          texts={texts}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}

// ─── Fitxa ───────────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise: e,
  basePath,
  deleteAction,
  texts,
  onPlay,
}: {
  exercise: Exercise;
  basePath?: string;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  texts: LibraryTexts;
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
        <VideoIndicator
          kind={kind}
          url={e.videoUrl}
          texts={texts}
          onPlay={onPlay}
        />

        {/* Editar i esborrar només hi són per a qui manté la biblioteca. */}
        {basePath && deleteAction && (
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
                className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error active:opacity-70 ${TAP}`}
              >
                Eliminar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export function VideoIndicator({
  kind,
  url,
  texts,
  onPlay,
}: {
  kind: VideoKind;
  url: string | null;
  texts: LibraryTexts;
  onPlay: () => void;
}) {
  const box =
    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors";

  if (kind === "none")
    return <span className="text-xs text-brand-muted">{texts.noVideo}</span>;

  // Un enllaç que no és de YouTube no es pot encastar amb garanties: s'obre a
  // fora, que és el que ja feia abans.
  if (kind === "external")
    return (
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        title={texts.openExternal}
        aria-label={texts.openExternalAria}
        className={`${box} ${TAP} bg-brand-bg text-brand-muted hover:bg-brand-purple/10 hover:text-brand-purple active:bg-brand-purple/20`}
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    );

  return (
    <button
      type="button"
      onClick={onPlay}
      title={kind === "youtube" ? texts.watchYoutube : texts.watch}
      aria-label={texts.watch}
      className={`${box} ${TAP} ${
        kind === "youtube"
          ? "bg-white hover:bg-brand-bg active:bg-brand-border"
          : "bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20 active:bg-brand-purple/30"
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

export function VideoDialog({
  exercise: e,
  texts,
  onClose,
}: {
  exercise: PlayableExercise;
  texts: LibraryTexts;
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
        aria-label={texts.close}
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
            aria-label={texts.close}
            className={`rounded-lg p-1 text-brand-muted hover:bg-brand-bg hover:text-brand-dark active:bg-brand-border ${TAP}`}
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
            {texts.videoError}
          </p>
        ) : (
          <p className="rounded-lg bg-brand-bg px-4 py-8 text-center text-sm text-brand-muted">
            {texts.loading}
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
        TAP,
        active
          ? "border-brand-purple bg-brand-purple text-white active:bg-brand-purple-dark"
          : "border-brand-border bg-white text-brand-muted hover:border-brand-purple hover:text-brand-purple active:bg-brand-bg",
      )}
    >
      {label}
      <span
        className={clsx(
          "ml-1.5",
          active ? "text-white/70" : "text-brand-border",
        )}
      >
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
