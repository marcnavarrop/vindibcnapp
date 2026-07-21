"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ExerciseCategory } from "@/types/database";

const CATEGORY_OPTIONS = (
  Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[]
).map((value) => ({ value, label: EXERCISE_CATEGORY_LABELS[value] }));

export type ExerciseDefaults = {
  name: string;
  category: ExerciseCategory;
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
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: ExerciseDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [videoMode, setVideoMode] = useState<VideoMode>(initialMode(defaults));

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <Field label="Nom" name="name" required defaultValue={defaults?.name} />
      <SelectField
        label="Categoria"
        name="category"
        placeholder="Tria una categoria"
        required
        defaultValue={defaults?.category}
        options={CATEGORY_OPTIONS}
      />
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
              Fitxer de vídeo (MP4 / MOV, màx. 200 MB)
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
              className="text-sm text-brand-dark file:mr-3 file:rounded-lg file:border-0 file:bg-brand-purple file:px-3 file:py-1 file:text-xs file:font-bold file:text-white file:tracking-wide file:uppercase"
            />
          </div>
        )}
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href="/admin/exercicis"
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
