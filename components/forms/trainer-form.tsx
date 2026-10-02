"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { SPECIALTY_LABELS } from "@/lib/labels";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { Specialty } from "@/types/database";
import { TAP } from "@/lib/utils";

const SPECIALTY_OPTIONS = (
  Object.keys(SPECIALTY_LABELS) as Specialty[]
).map((s) => ({ value: s, label: SPECIALTY_LABELS[s] }));

export type TrainerDefaults = {
  fullName: string;
  email: string;
  specialty: Specialty | null;
  /** Signed URL de la foto actual, si en té. */
  avatarUrl?: string | null;
};

/**
 * Formulario de entrenador. En modo creación pide nombre, email y especialidad;
 * en modo edición la identidad es fija (solo se cambia la especialidad).
 */
export function TrainerForm({
  action,
  defaults,
  editableIdentity,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: TrainerDefaults;
  editableIdentity: boolean;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const fileRef = useRef<HTMLInputElement>(null);
  // Vista prèvia del fitxer triat; si no n'hi ha cap, la foto que ja tenia.
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // L'URL de l'objecte es allibera en canviar de fitxer o en desmuntar: si no,
  // cada tria deixaria un blob viu a la memòria de la pestanya.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Després d'un error React buida el formulari, també el camp de la foto. La
  // vista prèvia es quedaria ensenyant una foto que ja no s'enviaria: es treu,
  // i es diu que s'ha de tornar a triar.
  const [photoLost, setPhotoLost] = useState(false);

  useEffect(() => {
    if (!state.error) return;
    setPreview((p) => {
      if (p) setPhotoLost(true);
      return null;
    });
  }, [state]);

  const current = removed ? null : (preview ?? defaults?.avatarUrl ?? null);

  return (
    <form
      // Com a `ClientForm`: una clau nova a cada error torna a muntar el
      // formulari amb el que s'havia escrit, i el buidat de React 19 cau sobre
      // el vell.
      key={state.at ?? 0}
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      {editableIdentity ? (
        <>
          <Field
            label="Nom complet"
            name="fullName"
            required
            defaultValue={state.values?.fullName}
          />
          <Field
            label="Correu electrònic"
            name="email"
            type="email"
            required
            defaultValue={state.values?.email}
          />
        </>
      ) : (
        <div className="rounded-lg border border-brand-border bg-brand-bg p-4">
          <div className="text-lg font-bold text-brand-dark">
            {defaults?.fullName}
          </div>
          <div className="text-sm text-brand-muted">{defaults?.email}</div>
        </div>
      )}

      <div>
        <p className="mb-1 text-sm font-bold text-brand-dark">Foto de perfil</p>
        <p className="mb-3 text-xs text-brand-muted">
          Opcional. JPG, PNG o WEBP, fins a 3 MB. Si no n&apos;hi ha, es mostra
          la inicial com fins ara.
        </p>
        <div className="flex items-center gap-4">
          <Avatar
            name={defaults?.fullName ?? ""}
            email={defaults?.email ?? ""}
            url={current}
            size={64}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (preview) URL.revokeObjectURL(preview);
                setPreview(URL.createObjectURL(f));
                setRemoved(false);
                setPhotoLost(false);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs font-bold text-brand-charcoal hover:border-brand-purple ${TAP}`}
            >
              {current ? "Canviar foto" : "Triar foto"}
            </button>
            {current && (
              <button
                type="button"
                onClick={() => {
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(null);
                  setRemoved(true);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold text-brand-muted hover:text-error ${TAP}`}
              >
                Treure
              </button>
            )}
          </div>
        </div>
        <input type="hidden" name="removeAvatar" value={removed ? "true" : "false"} />
      </div>

      <SelectField
        label="Especialitat"
        name="specialty"
        placeholder="Tria una especialitat"
        required
        defaultValue={state.values?.specialty ?? defaults?.specialty ?? ""}
        options={SPECIALTY_OPTIONS}
      />

      {state.error && (
        <p role="alert" className="text-sm text-error">
          {state.error}
          {photoLost && " Torna a triar la foto: no s'ha desat res."}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href={cancelHref}
          className={`text-sm font-bold text-brand-muted hover:text-brand-purple ${TAP}`}
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
