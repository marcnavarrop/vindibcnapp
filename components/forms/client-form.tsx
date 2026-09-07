"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { TextAreaField } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import { TAP } from "@/lib/utils";

export type ClientDefaults = {
  fullName: string;
  email: string;
  phone: string;
  assignedTrainerId: string;
  clinicalNotes: string;
  generalNotes: string;
};

export function ClientForm({
  action,
  trainers,
  defaults,
  trialId,
  submitLabel,
  cancelHref,
  editableEmail,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  trainers: { id: string; name: string }[];
  defaults?: ClientDefaults;
  /** Si es converteix una sessió de prova, el seu id (per vincular-la). */
  trialId?: string;
  submitLabel: string;
  cancelHref: string;
  /**
   * `true` només a l'ALTA, que és l'únic lloc on aquest camp fa el que sembla:
   * hi neix l'usuari d'Auth i decideix amb quin correu entrarà.
   *
   * A l'edició era un camp normal que només reescrivia `profiles.email`, i
   * `auth.users.email` es quedava com estava: el mateix control, el mateix
   * rètol i dos significats segons la pantalla. Una errata separava en silenci
   * "amb quin correu entra" de "on li arriben els avisos", i el primer símptoma
   * hauria estat un client que no pot entrar i a qui la recuperació de
   * contrasenya tampoc troba.
   *
   * Es diu `editableEmail` i no `editableIdentity` com al `TrainerForm` perquè
   * aquí NOMÉS governa el correu: el nom segueix sent editable. Res no depèn
   * de `full_name` —no té bessó a `auth.users`— i bloquejar-lo només hauria
   * copiat un altre problema del formulari de professional, on una errata al
   * nom es queda per sempre.
   */
  editableEmail: boolean;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      {trialId && <input type="hidden" name="trialId" value={trialId} />}
      <Field
        label="Nom complet"
        name="fullName"
        required
        defaultValue={defaults?.fullName}
      />
      {editableEmail ? (
        <Field
          label="Correu electrònic"
          name="email"
          type="email"
          required
          defaultValue={defaults?.email}
        />
      ) : (
        /*
         * Mateixa forma que a Configuració del client (`profile-settings-form`):
         * el correu es veu —l'admin l'ha de poder llegir— però ni s'edita ni
         * s'envia. `disabled` és el que fa que no viatgi al FormData; el motiu
         * de debò que no es pugui canviar és que `updateClientRecord` ja no en
         * sap res. Amagar-lo aquí és comoditat, no la barrera.
         */
        <div>
          <Field
            label="Correu electrònic"
            name="email"
            type="email"
            defaultValue={defaults?.email}
            disabled
            readOnly
          />
          <p className="mt-1 text-xs text-brand-muted">
            El correu és l&apos;usuari d&apos;accés del client i no es pot
            canviar des d&apos;aquí.
          </p>
        </div>
      )}
      <Field
        label="Telèfon"
        name="phone"
        type="tel"
        defaultValue={defaults?.phone}
      />
      <SelectField
        label="Professional assignat/da"
        name="assignedTrainerId"
        placeholder="Sense assignar"
        defaultValue={defaults?.assignedTrainerId}
        options={trainers.map((t) => ({ value: t.id, label: t.name }))}
      />
      <TextAreaField
        label="Notes clíniques"
        name="clinicalNotes"
        defaultValue={defaults?.clinicalNotes}
      />
      <TextAreaField
        label="Notes generals"
        name="generalNotes"
        defaultValue={defaults?.generalNotes}
      />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

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
