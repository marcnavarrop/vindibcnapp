"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { createExerciseCategoryAction, type CategoryFormState } from "@/lib/actions/exercise-category-actions";
import type { ExerciseCategoryItem } from "@/lib/data/exercise-categories";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import {
  checkExerciseVideo,
  VIDEO_LIMIT_LABEL,
} from "@/lib/exercise-video.constants";
import type { FormState } from "@/app/(admin)/admin/clients/actions";

export type ExerciseDefaults = {
  name: string;
  categoryId: string;
  description: string;
  videoUrl: string;
  videoFilePath: string | null;
};

type VideoMode = "url" | "file" | "none";

function initialMode(defaults?: ExerciseDefaults): VideoMode {
  if (!defaults) return "none";
  if (defaults.videoFilePath) return "file";
  if (defaults.videoUrl) return "url";
  return "none";
}

export function ExerciseForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  categories,
  basePath,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: ExerciseDefaults;
  submitLabel: string;
  /** On torna el "Cancel·lar": cada àrea a la seva biblioteca. */
  cancelHref: string;
  /** Categories existents, llegides de la taula (0057). */
  categories: ExerciseCategoryItem[];
  basePath: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  /**
   * Crear una categoria sense sortir del formulari.
   *
   * Va per una acció pròpia i no per un camp del mateix enviament perquè qui
   * està donant d'alta un exercici ja té el nom escrit i mig formulari omplert:
   * obligar-lo a desar, anar a gestió de categories, crear-la i tornar a
   * començar és el camí que fa que no se'n creïn.
   */
  const [catState, createCategory, catPending] = useActionState(
    createExerciseCategoryAction.bind(null, basePath),
    {} as CategoryFormState,
  );
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newName, setNewName] = useState("");
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
  /**
   * Les categories creades des d'aquí.
   *
   * Es guarden al client i no s'espera que tornin del servidor: `categories`
   * arriba com a prop d'un component de servidor, i revalidar la biblioteca no
   * torna a pintar AQUESTA pàgina. Sense això, la categoria es creava de debò
   * però el desplegable seguia sense tenir-la.
   */
  const [extra, setExtra] = useState<ExerciseCategoryItem[]>([]);

  // Quan el servidor confirma la categoria nova, s'afegeix a la llista, es
  // tria sola i el camp es tanca: qui l'acaba de crear la vol per a AQUEST
  // exercici.
  useEffect(() => {
    const created = catState.created;
    if (!created) return;
    setExtra((prev) =>
      prev.some((c) => c.id === created.id)
        ? prev
        : [...prev, { id: created.id, name: created.name, exerciseCount: 0 }],
    );
    setCategoryId(created.id);
    setCreatingCategory(false);
    setNewName("");
  }, [catState.created]);

  function submitCategory() {
    const name = newName.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    // Dins d'una transició: cridar el dispatch de `useActionState` fora d'una
    // en deixa `catPending` sense actualitzar, i el botó no diria "Creant…"
    // ni es bloquejaria mentre dura.
    startTransition(() => createCategory(fd));
  }

  const options = [...categories, ...extra]
    .filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i)
    .sort((a, b) => a.name.localeCompare(b.name, "ca"))
    .map((c) => ({ value: c.id, label: c.name }));
  const [videoMode, setVideoMode] = useState<VideoMode>(initialMode(defaults));
  /**
   * Error del fitxer detectat AQUÍ, abans d'enviar res.
   *
   * Sense això, un vídeo massa gros no arribava ni al servidor: Next talla la
   * petició pel `bodySizeLimit` i el resultat era una pantalla d'"Application
   * error", no un missatge. Comprovar-ho al navegador estalvia el viatge i,
   * sobretot, diu què passa.
   */
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (fileError) e.preventDefault();
      }}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <Field label="Nom" name="name" required defaultValue={defaults?.name} />
      <div className="flex flex-col gap-2">
        <SelectField
          label="Categoria"
          name="category"
          placeholder="Tria una categoria"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={options}
        />

        {creatingCategory ? (
          <div className="flex flex-col gap-2 rounded-lg border border-brand-border bg-brand-bg p-3">
            <label className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Nom de la categoria nova
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                autoFocus
                placeholder="Ex.: Estiraments"
                className="min-w-0 flex-1 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
                onKeyDown={(e) => {
                  // Enter aquí crearia la categoria I enviaria l'exercici a
                  // mig omplir: es queda només amb el primer.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitCategory();
                  }
                }}
              />
              {/*
                Un botó normal que crida l'acció, no un submit.
                Un formulari no es pot niar dins d'un altre, i enviar aquest
                mateix formulari a una segona acció amb `formAction` no arriba a
                disparar-se: el clic no produïa cap petició.
              */}
              <Button
                type="button"
                onClick={submitCategory}
                disabled={catPending || !newName.trim()}
              >
                {catPending ? "Creant…" : "Crear"}
              </Button>
              <button
                type="button"
                onClick={() => setCreatingCategory(false)}
                className="text-sm font-bold text-brand-muted hover:text-brand-dark"
              >
                Cancel·lar
              </button>
            </div>
            {catState.error && (
              <p className="text-sm text-error">{catState.error}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreatingCategory(true)}
            className="self-start text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
          >
            + Crear categoria nova
          </button>
        )}
      </div>
      <TextAreaField
        label="Descripció"
        name="description"
        defaultValue={defaults?.description}
      />

      {/* Selector de mode de vídeo */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
          Vídeo d&apos;exemple (opcional)
        </span>
        <div className="flex gap-4 text-sm">
          {(["none", "url", "file"] as VideoMode[]).map((mode) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="videoMode"
                value={mode}
                checked={videoMode === mode}
                onChange={() => setVideoMode(mode)}
                className="accent-brand-purple"
              />
              {mode === "none" && "Sense vídeo"}
              {mode === "url" && "Enllaç (YouTube, Vimeo...)"}
              {mode === "file" && "Pujar vídeo propi"}
            </label>
          ))}
        </div>

        {videoMode === "url" && (
          <Field
            label="URL del vídeo"
            name="videoUrl"
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            defaultValue={defaults?.videoUrl}
          />
        )}

        {videoMode === "file" && (
          <div className="flex flex-col gap-2">
            {/* Si ja hi ha un vídeo pujat i no se'n selecciona de nou, conservem el path */}
            {defaults?.videoFilePath && (
              <input
                type="hidden"
                name="existingVideoFilePath"
                value={defaults.videoFilePath}
              />
            )}
            <label className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Fitxer de vídeo ({VIDEO_LIMIT_LABEL})
            </label>
            {defaults?.videoFilePath && (
              <p className="rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-muted">
                Ja hi ha un vídeo pujat. Selecciona un fitxer nou per
                substituir-lo, o deixa-ho en blanc per conservar-lo.
              </p>
            )}
            <input
              type="file"
              name="videoFile"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return setFileError(null);
                const check = checkExerciseVideo(f);
                setFileError(check.ok ? null : check.error);
              }}
              className="text-sm text-brand-dark file:mr-3 file:rounded-lg file:border-0 file:bg-brand-purple file:px-3 file:py-1 file:text-xs file:font-bold file:text-white file:tracking-wide file:uppercase"
            />
            {fileError && (
              <p className="text-sm text-error" role="alert">
                {fileError}
              </p>
            )}
          </div>
        )}
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href={cancelHref}
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
