"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { LANGUAGE_LABELS, GENDER_LABELS } from "@/lib/labels";
import {
  updateProfileAction,
  type FormState,
} from "@/app/(client)/client/configuracio/actions";
import type { ProfileSettings } from "@/lib/data/clients";
import type { PreferredLanguage, Gender } from "@/types/database";

const LANGUAGE_OPTIONS = (
  Object.keys(LANGUAGE_LABELS) as PreferredLanguage[]
).map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }));

const GENDER_OPTIONS = (Object.keys(GENDER_LABELS) as Gender[]).map((g) => ({
  value: g,
  label: GENDER_LABELS[g],
}));

export function ProfileSettingsForm({ settings }: { settings: ProfileSettings }) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    {} as FormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* a) Dades personals */}
      <section className="flex flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Dades personals
        </h2>
        <Field
          label="Nom complet"
          name="fullName"
          required
          defaultValue={settings.fullName}
        />
        <div>
          <Field
            label="Correu electrònic"
            name="email"
            type="email"
            defaultValue={settings.email}
            disabled
            readOnly
          />
          <p className="mt-1 text-xs text-brand-muted">
            El correu és el teu usuari d&apos;accés i no es pot canviar aquí.
          </p>
        </div>
        <Field
          label="Telèfon"
          name="phone"
          type="tel"
          defaultValue={settings.phone}
        />
        <Field
          label="Data de naixement"
          name="birthDate"
          type="date"
          defaultValue={settings.birthDate}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Alçada (cm)"
            name="heightCm"
            type="number"
            min={50}
            max={260}
            defaultValue={settings.heightCm}
          />
          <Field
            label="Pes (kg)"
            name="weightKg"
            type="number"
            min={20}
            max={400}
            step="0.1"
            defaultValue={settings.weightKg}
          />
        </div>
        <SelectField
          label="Gènere"
          name="gender"
          placeholder="Prefereixo no dir-ho"
          defaultValue={settings.gender}
          options={GENDER_OPTIONS}
        />
        <Field
          label="Contacte d'emergència"
          name="emergencyContact"
          placeholder="Nom i telèfon"
          defaultValue={settings.emergencyContact}
        />
        <TextAreaField
          label="Objectiu"
          name="objective"
          placeholder="Què vols aconseguir? (perdre pes, rehabilitació, força...)"
          defaultValue={settings.objective}
        />
      </section>

      {/* b) Preferències */}
      <section className="flex flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Preferències
        </h2>
        <div>
          <SelectField
            label="Idioma"
            name="preferredLanguage"
            defaultValue={settings.preferredLanguage}
            options={LANGUAGE_OPTIONS}
          />
          <p className="mt-1 text-xs text-brand-muted">
            De moment només es desa la preferència; la traducció de la interfície
            arribarà més endavant.
          </p>
        </div>
      </section>

      {state.error && <p className="text-sm text-error">{state.error}</p>}
      {state.ok && (
        <p className="text-sm font-bold text-success">Canvis desats.</p>
      )}

      <div>
        <SubmitButton>Desar canvis</SubmitButton>
      </div>
    </form>
  );
}
