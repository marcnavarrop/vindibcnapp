"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCenterSettingsAction } from "@/app/(admin)/admin/configuracio/center-actions";
import type { CenterSettings } from "@/lib/data/center-settings";

/** Bloc temàtic: títol, descripció i barra esquerra. Tots els ajustos de la
 *  pàgina n'usen un, perquè cap secció es vegi diferent de les altres només
 *  per haver-se afegit en un altre moment. */
function Group({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-brand-border pt-4">
      <p className="text-sm font-bold tracking-wide text-brand-purple uppercase">
        {title}
      </p>
      <p className="mt-0.5 mb-4 text-xs text-brand-muted">{desc}</p>
      <div className="ml-1 flex flex-col gap-5 border-l-2 border-brand-purple/30 pl-5">
        {children}
      </div>
    </div>
  );
}

/** Interruptor + etiqueta, amb l'input ocult que el server action llegeix. */
function Toggle({
  name,
  title,
  desc,
  checked,
  onChange,
}: {
  name: string;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-brand-dark">{title}</p>
        <p className="mt-0.5 text-xs text-brand-muted">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple ${
          checked ? "bg-brand-purple" : "bg-brand-border"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
    </div>
  );
}

/** Camp numèric amb etiqueta, ajuda i sufix d'unitat. */
function NumField({
  name,
  label,
  help,
  unit,
  min,
  max,
  defaultValue,
}: {
  name: string;
  label: string;
  help: string;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-bold text-brand-dark">
        {label}
      </label>
      <p className="mb-3 text-xs text-brand-muted">{help}</p>
      <div className="flex items-center gap-3">
        <input
          id={name}
          name={name}
          type="number"
          min={min}
          max={max}
          step={1}
          required
          defaultValue={defaultValue}
          className="w-28 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
        />
        <span className="text-sm text-brand-muted">{unit}</span>
      </div>
    </div>
  );
}

export function CenterSettingsForm({ settings }: { settings: CenterSettings }) {
  const [state, action] = useActionState(updateCenterSettingsAction, {});
  const [trainersSeColleagues, setTrainersSeColleagues] = useState(
    settings.trainersSeColleaguesReservations,
  );
  const [referralActive, setReferralActive] = useState(settings.referralProgramActive);
  const [referralReferee, setReferralReferee] = useState(settings.referralRewardReferee);
  const [referralPercent, setReferralPercent] = useState(
    String(settings.referralDiscountPercent),
  );
  const [modComunitat, setModComunitat] = useState(settings.modules.comunitat);
  const [modProva, setModProva] = useState(settings.modules.sessionsProva);
  const [modDocuments, setModDocuments] = useState(settings.modules.documents);

  return (
    <form
      action={action}
      className="flex flex-col gap-6 rounded-2xl border border-brand-border bg-white p-6"
    >
      <Group
        title="Horari i reserves"
        desc="La franja que mostren tots els calendaris i quanta antelació cal per reservar o cancel·lar."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <NumField
            name="openingHour"
            label="Hora d'obertura"
            help="Primera franja visible als calendaris."
            unit="h"
            min={0}
            max={22}
            defaultValue={settings.openingHour}
          />
          <NumField
            name="closingHour"
            label="Hora de tancament"
            help="Última franja visible (exclosa)."
            unit="h"
            min={1}
            max={23}
            defaultValue={settings.closingHour}
          />
        </div>
        <NumField
          name="minBookingHours"
          label="Antelació mínima per reservar"
          help="El client no podrà reservar una sessió que comenci abans d'aquest marge. Posa 0 per permetre reservar fins al darrer moment."
          unit="hores"
          min={0}
          max={720}
          defaultValue={settings.minBookingHours}
        />
        <NumField
          name="minCancellationHours"
          label="Antelació mínima per cancel·lar"
          help="El client no podrà cancel·lar si la sessió és en menys d'aquest nombre d'hores. Posa 0 per permetre cancel·lació fins al darrer moment."
          unit="hores"
          min={0}
          max={168}
          defaultValue={settings.minCancellationHours}
        />
      </Group>

      <Group
        title="Bons"
        desc="Quan avisem el client que se li acaba el bo i quant temps és vàlid des de la compra."
      >
        <NumField
          name="bonoLowThreshold"
          label="Llindar de bo a punt d'esgotar-se"
          help="Sessions restants que disparen l'avís al client i que fan aparèixer el bo al panell de l'admin."
          unit="sessions"
          min={0}
          max={50}
          defaultValue={settings.bonoLowThreshold}
        />
        <NumField
          name="bonoExpiryMonths"
          label="Caducitat dels bons"
          help="Mesos de validesa des de la compra. Buit o 0 = sense caducitat. Només afecta els bons que es comprin a partir d'ara: els ja venuts conserven la seva data."
          unit="mesos"
          min={0}
          max={120}
          defaultValue={settings.bonoExpiryMonths ?? 0}
        />
      </Group>

      <Group
        title="Notificacions"
        desc="A quina hora surten els avisos automàtics del dia."
      >
        <NumField
          name="reminderHourLocal"
          label="Hora dels recordatoris"
          help="Hora local del centre a partir de la qual s'envien els recordatoris de sessió."
          unit="h"
          min={0}
          max={23}
          defaultValue={settings.reminderHourLocal}
        />
      </Group>

      <Group
        title="Coordinació entre professionals"
        desc="Què veu cada entrenador de l'agenda dels seus companys."
      >
        <Toggle
          name="trainersSeColleaguesReservations"
          title="Els entrenadors veuen les reserves dels companys"
          desc="Permet la coordinació entre professionals mostrant les reserves de tots al calendari. Si està desactivat, cada entrenador només veu les seves pròpies reserves."
          checked={trainersSeColleagues}
          onChange={setTrainersSeColleagues}
        />
      </Group>

      <Group
        title="Referits"
        desc="Descomptes per als clients que en porten de nous."
      >
        <Toggle
          name="referralProgramActive"
          title="Sistema de referits actiu"
          desc="Permet que els clients comparteixin el seu codi personal per obtenir descomptes quan algú nou s'apunta gràcies a ells."
          checked={referralActive}
          onChange={setReferralActive}
        />

        {/*
          Els valors viatgen en inputs ocults FORA del fieldset: un fieldset
          deshabilitat no envia els seus camps, i el server action interpreta
          un percentatge absent com a 10 (center-actions.ts).
        */}
        <input
          type="hidden"
          name="referralRewardReferee"
          value={referralReferee ? "true" : "false"}
        />
        <input
          type="hidden"
          name="referralDiscountPercent"
          value={referralPercent}
        />

        {/* Opcions dependents: sagnades i lligades al toggle mestre per la barra
            esquerra. `disabled` al fieldset les treu també del tab order. */}
        <fieldset
          disabled={!referralActive}
          className={`flex flex-col gap-5 border-l-2 pl-4 transition-opacity ${
            referralActive
              ? "border-brand-purple/30"
              : "border-brand-border opacity-50"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-brand-dark">
                Recompensar també el nou client
              </p>
              <p className="mt-0.5 text-xs text-brand-muted">
                A més del client que refereix, el nou client (referit) també rep
                el mateix descompte en la seva propera compra.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={referralReferee}
              onClick={() => setReferralReferee((v) => !v)}
              className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple disabled:cursor-not-allowed ${
                referralReferee ? "bg-brand-purple" : "bg-brand-border"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  referralReferee ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div>
            <label
              htmlFor="referralDiscountPercent"
              className="mb-1 block text-sm font-bold text-brand-dark"
            >
              Percentatge de descompte de referit
            </label>
            <p className="mb-3 text-xs text-brand-muted">
              S&apos;aplica tant al client que refereix com al nou client (si
              l&apos;opció anterior està activa).
            </p>
            <div className="flex items-center gap-3">
              <input
                id="referralDiscountPercent"
                type="number"
                min={1}
                max={100}
                step={0.5}
                value={referralPercent}
                onChange={(e) => setReferralPercent(e.target.value)}
                className="w-28 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none disabled:cursor-not-allowed disabled:bg-brand-bg"
              />
              <span className="text-sm text-brand-muted">%</span>
            </div>
          </div>
        </fieldset>
      </Group>

      <Group
        title="Mòduls"
        desc="Desactiva el que el centre no fa servir: desapareix del menú i la seva adreça deixa d'existir."
      >
        <Toggle
          name="moduleComunitat"
          title="Comunitat"
          desc="Anuncis, novetats i enquestes per a clients i entrenadors."
          checked={modComunitat}
          onChange={setModComunitat}
        />
        <Toggle
          name="moduleSessionsProva"
          title="Sessions de prova"
          desc="Pàgina pública de sol·licitud de prova gratuïta i la seva gestió."
          checked={modProva}
          onChange={setModProva}
        />
        <Toggle
          name="moduleDocuments"
          title="Documents"
          desc="Zona de documents personals del client."
          checked={modDocuments}
          onChange={setModDocuments}
        />
      </Group>

      {state.error && (
        <p className="text-sm text-error">{state.error}</p>
      )}
      {state.ok && (
        <p className="text-sm text-success">Desat correctament.</p>
      )}

      <div>
        <SubmitButton>Desar configuració</SubmitButton>
      </div>
    </form>
  );
}
