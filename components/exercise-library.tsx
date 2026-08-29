"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ExerciseVideoPlayer } from "@/components/exercise-video-player";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import { normalizeForSearch, clsx } from "@/lib/utils";
import type { Exercise } from "@/lib/data/exercises";
import type { ExerciseCategory } from "@/types/database";

/**
 * El banc d'exercicis, compartit per l'admin i el professional.
 *
 * Abans eren dues pantalles: la de l'admin amb els botons i la del
 * professional només de lectura, tot i que la RLS ja el deixava escriure des de
 * la 0003. Ara és la mateixa, i el que canvia és només on porten els enllaços.
 *
 * La cerca i el filtre viuen al navegador i no al servidor a posta: la
 * biblioteca d'un centre són desenes d'exercicis, no milers, i filtrar mentre
 * s'escriu —sense esperar cap petició— és el que fa que serveixi per buscar
 * "aquell d'espatlla" enmig d'una sessió.
 */

const CATEGORIES = Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[];

function hasVideo(e: Exercise): boolean {
  return Boolean(e.videoUrl || e.videoFilePath);
}

export function ExerciseLibrary({
  exercises,
  basePath,
  deleteAction,
}: {
  exercises: Exercise[];
  /** "/admin/exercicis" o "/trainer/exercicis". */
  basePath: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");

  // Alfabètic sempre: la consulta ja hi arriba ordenada, però ordenar-ho aquí
  // també cobreix el mode simulació i qualsevol canvi futur a la query.
  const ordered = useMemo(
    () => [...exercises].sort((a, b) => a.name.localeCompare(b.name, "ca")),
    [exercises],
  );

  /** Quants n'hi ha de cada categoria, per posar-ho al filtre. */
  const counts = useMemo(() => {
    const map = new Map<ExerciseCategory, number>();
    for (const e of ordered) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return map;
  }, [ordered]);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    return ordered.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (!q) return true;
      // També per descripció: molts exercicis es recorden pel que treballen
      // ("rotació externa"), no pel nom exacte que se'ls va posar.
      return (
        normalizeForSearch(e.name).includes(q) ||
        normalizeForSearch(e.description).includes(q)
      );
    });
  }, [ordered, query, category]);

  const filtering = query.trim() !== "" || category !== "all";

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
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="Totes"
            count={ordered.length}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={EXERCISE_CATEGORY_LABELS[c]}
              count={counts.get(c) ?? 0}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-brand-muted" aria-live="polite">
        {filtering
          ? `${filtered.length} de ${ordered.length} exercicis`
          : `${ordered.length} ${ordered.length === 1 ? "exercici" : "exercicis"}`}
      </p>

      {/* ── Resultats ── */}
      {ordered.length === 0 ? (
        <Empty>Encara no hi ha exercicis. Crea&apos;n el primer.</Empty>
      ) : filtered.length === 0 ? (
        // Es distingeix de la biblioteca buida a posta: aquí el problema és el
        // filtre, i el que cal oferir és treure'l, no crear res.
        <Empty>
          Cap exercici coincideix amb la cerca.{" "}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
            className="font-bold text-brand-purple underline hover:text-brand-orange"
          >
            Veure&apos;ls tots
          </button>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg text-brand-dark">{e.name}</h2>
                <Badge tone="info">{EXERCISE_CATEGORY_LABELS[e.category]}</Badge>
              </div>

              {e.description && (
                <p className="text-sm text-brand-muted">{e.description}</p>
              )}

              {hasVideo(e) ? (
                <ExerciseVideoPlayer
                  videoUrl={e.videoUrl}
                  videoFilePath={e.videoFilePath}
                />
              ) : (
                // Dir-ho explícitament i no deixar el buit: en assignar
                // exercicis interessa saber quins porten demostració i quins
                // s'hauran d'explicar a mà.
                <p className="rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-muted">
                  Sense vídeo
                </p>
              )}

              <div className="mt-2 flex items-center gap-4">
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
          ))}
        </div>
      )}
    </div>
  );
}

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
