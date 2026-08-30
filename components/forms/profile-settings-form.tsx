"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  updateProfileAction,
  type FormState,
} from "@/app/(client)/client/configuracio/actions";
import type { ProfileSettings } from "@/lib/data/clients";
import type { Gender } from "@/types/database";

const GENDERS: Gender[] = ["home", "dona", "altre", "ns_nc"];

export function ProfileSettingsForm({ settings }: { settings: ProfileSettings }) {
  const t = useTranslations("config.profile");
  const te = useTranslations("config.profile.errors");
  const tg = useTranslations("labels.gender");
  const genderOptions = GENDERS.map((g) => ({ value: g, label: tg(g) }));
  const [state, formAction] = useActionState(
    updateProfileAction,
    {} as FormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* a) Dades personals */}
      <section className="flex flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          {t("title")}
        </h2>
        <Field
          label={t("fullName")}
          name="fullName"
          required
          defaultValue={settings.fullName}
        />
        <div>
          <Field
            label={t("email")}
            name="email"
            type="email"
            defaultValue={settings.email}
            disabled
            readOnly
          />
          <p className="mt-1 text-xs text-brand-muted">
            {t("emailHint")}
          </p>
        </div>
        <Field
          label={t("phone")}
          name="phone"
          type="tel"
          defaultValue={settings.phone}
        />
        <Field
          label={t("birthDate")}
          name="birthDate"
          type="date"
          defaultValue={settings.birthDate}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("height")}
            name="heightCm"
            type="number"
            min={50}
            max={260}
            defaultValue={settings.heightCm}
          />
          <Field
            label={t("weight")}
            name="weightKg"
            type="number"
            min={20}
            max={400}
            step="0.1"
            defaultValue={settings.weightKg}
          />
        </div>
        <SelectField
          label={t("gender")}
          name="gender"
          placeholder={tg("ns_nc")}
          defaultValue={settings.gender}
          options={genderOptions}
        />
        <Field
          label={t("emergency")}
          name="emergencyContact"
          placeholder={t("emergencyPlaceholder")}
          defaultValue={settings.emergencyContact}
        />
        <TextAreaField
          label={t("objective")}
          name="objective"
          placeholder={t("objectivePlaceholder")}
          defaultValue={settings.objective}
        />
      </section>

      {state.errorCode && (
        <p className="text-sm text-error">{te(state.errorCode)}</p>
      )}
      {state.ok && (
        <p className="text-sm font-bold text-success">{t("saved")}</p>
      )}

      <div>
        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}
