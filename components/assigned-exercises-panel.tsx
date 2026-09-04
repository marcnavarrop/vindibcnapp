"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TAP } from "@/lib/utils";
import {
  VideoIndicator,
  VideoDialog,
  videoKind,
  LIBRARY_TEXTS_CA,
} from "@/components/exercise-library";
import type { AssignedExercise } from "@/lib/data/client-exercises";
import type { Exercise } from "@/lib/data/exercises";

/**
 * Secció "Exercicis assignats" de la fitxa d'un client, compartida entre admin
 * i professional. Amb `canManage` surten el formulari d'assignació i els botons
 * de treure; sense, només la llista en lectura.
 *
 * LA TERCERA VISTA DEL MATEIX VÍDEO. Abans muntava aquí un reproductor gran
 * incrustat —`components/exercise-video-player.tsx`, que era l'últim que el
 * feia servir i ja s'ha esborrat— mentre la biblioteca i els exercicis
 * assignats de l'àrea de client ja feien servir la fitxa compacta amb icona i
 * diàleg. Eren tres maneres de fer el mateix. Ara les tres criden
 * `VideoIndicator`, `VideoDialog` i `videoKind`, i els textos surten de
 * `LIBRARY_TEXTS_CA`: aquí no es poden traduir amb hooks perquè l'admin i el
 * professional van en català fix i no tenen `NextIntlClientProvider` a sobre.
 *
 * "use client" perquè el diàleg necessita estat. Les server actions arriben com
 * a propietats i funcionen igual: el que canvia és on es pinta, no qui escriu.
 *
 * El que NO és de les altres dues vistes i es queda intacte: treure un exercici
 * i el formulari d'assignar-ne un de nou. El progrés no viu aquí —és la pestanya
 * "Progrés" de la fitxa, un component a part.
 */
export function AssignedExercisesPanel({
  assigned,
  library,
  canManage,
  assignAction,
  removeAction,
}: {
  assigned: AssignedExercise[];
  library: Exercise[];
  canManage: boolean;
  assignAction: (formData: FormData) => void | Promise<void>;
  removeAction: (formData: FormData) => void | Promise<void>;
}) {
  const [playing, setPlaying] = useState<AssignedExercise | null>(null);

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Exercicis assignats
        </h2>
      </div>

      {assigned.length === 0 ? (
        <p className="px-5 py-3 text-sm text-brand-muted">
          Encara no hi ha exercicis assignats.
        </p>
      ) : (
        // Mateixa graella i mateixa targeta que a l'àrea de client: accent lila
        // per distingir "el que li han posat a ell" de la biblioteca del centre.
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {assigned.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-2 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base leading-tight font-bold text-brand-dark">
                  {a.name}
                </h3>
                <Badge tone="info">{a.categoryName}</Badge>
              </div>

              {/* La nota del professional va sencera: és una instrucció per a
                  aquesta persona, no una descripció del catàleg. */}
              {a.notes && (
                <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-brand-charcoal">
                  {a.notes}
                </p>
              )}

              {a.description && (
                <p className="line-clamp-2 text-sm text-brand-muted">
                  {a.description}
                </p>
              )}

              <div className="mt-auto flex items-center gap-3 pt-2">
                <VideoIndicator
                  kind={videoKind(a)}
                  url={a.videoUrl}
                  texts={LIBRARY_TEXTS_CA}
                  onPlay={() => setPlaying(a)}
                />
                {canManage && (
                  <form action={removeAction} className="ml-auto">
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-error ${TAP}`}
                    >
                      Treure
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && library.length > 0 && (
        <form
          action={assignAction}
          className="flex flex-col gap-3 border-t border-brand-border p-5 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Exercici
            </span>
            <select
              name="exerciseId"
              required
              defaultValue=""
              className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
            >
              <option value="" disabled>
                Tria un exercici…
              </option>
              {library.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-[2] flex-col gap-1 text-sm">
            <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Notes (opcional)
            </span>
            <input
              name="notes"
              placeholder="3 sèries de 12, dos cops/setmana"
              className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
            />
          </label>
          <button
            type="submit"
            className={`rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            Assignar
          </button>
        </form>
      )}

      {playing && (
        <VideoDialog
          exercise={playing}
          texts={LIBRARY_TEXTS_CA}
          onClose={() => setPlaying(null)}
        />
      )}
    </section>
  );
}
