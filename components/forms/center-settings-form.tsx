"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCenterSettingsAction } from "@/app/(admin)/admin/configuracio/center-actions";
import type { CenterSettings } from "@/lib/data/center-settings";

export function CenterSettingsForm({ settings }: { settings: CenterSettings }) {
  const [state, action] = useActionState(updateCenterSettingsAction, {});
  const [trainersSeColleagues, setTrainersSeColleagues] = useState(
    settings.trainersSeColleaguesReservations,
  );
  const [referralActive, setReferralActive] = useState(settings.referralProgramActive);
  const [referralReferee, setReferralReferee] = useState(settings.referralRewardReferee);

  return (
    <form
      action={action}
      className="flex flex-col gap-6 rounded-2xl border border-brand-border bg-white p-6"
    >
      <div>
        <label
          htmlFor="minCancellationHours"
          className="mb-1 block text-sm font-bold text-brand-dark"
        >
          Hores mínimes per cancel·lar una reserva
        </label>
        <p className="mb-3 text-xs text-brand-muted">
          El client no podrà cancel·lar si la sessió és en menys d&apos;aquest
          nombre d&apos;hores. Posa 0 per permetre cancel·lació fins al darrer
          moment.
        </p>
        <div className="flex items-center gap-3">
          <input
            id="minCancellationHours"
            name="minCancellationHours"
            type="number"
            min={0}
            max={168}
            step={1}
            required
            defaultValue={settings.minCancellationHours}
            className="w-28 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
          />
          <span className="text-sm text-brand-muted">hores</span>
        </div>
      </div>

      <div className="border-t border-brand-border pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-brand-dark">
              Els entrenadors veuen les reserves dels companys
            </p>
            <p className="mt-0.5 text-xs text-brand-muted">
              Permet la coordinació entre professionals mostrant les reserves de
              tots al calendari. Si està desactivat, cada entrenador només veu
              les seves pròpies reserves.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={trainersSeColleagues}
            onClick={() => setTrainersSeColleagues((v) => !v)}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple ${
              trainersSeColleagues ? "bg-brand-purple" : "bg-brand-border"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                trainersSeColleagues ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {/* Hidden input que envia el valor real al server action */}
        <input
          type="hidden"
          name="trainersSeColleaguesReservations"
          value={trainersSeColleagues ? "true" : "false"}
        />
      </div>

      {/* ── Sistema de referits ── */}
      <div className="border-t border-brand-border pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-brand-dark">
              Sistema de referits actiu
            </p>
            <p className="mt-0.5 text-xs text-brand-muted">
              Permet que els clients comparteixin el seu codi personal per
              obtenir descomptes quan algú nou s&apos;apunta gràcies a ells.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={referralActive}
            onClick={() => setReferralActive((v) => !v)}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple ${
              referralActive ? "bg-brand-purple" : "bg-brand-border"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                referralActive ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <input type="hidden" name="referralProgramActive" value={referralActive ? "true" : "false"} />
      </div>

      {referralActive && (
        <>
          <div className="border-t border-brand-border pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-brand-dark">
                  Recompensar també el nou client
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  A més del client que refereix, el nou client (referit) també
                  rep el mateix descompte en la seva propera compra.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={referralReferee}
                onClick={() => setReferralReferee((v) => !v)}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple ${
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
            <input type="hidden" name="referralRewardReferee" value={referralReferee ? "true" : "false"} />
          </div>

          <div className="border-t border-brand-border pt-4">
            <label htmlFor="referralDiscountPercent" className="mb-1 block text-sm font-bold text-brand-dark">
              Percentatge de descompte de referit
            </label>
            <p className="mb-3 text-xs text-brand-muted">
              S&apos;aplica tant al client que refereix com al nou client (si l&apos;opció anterior està activa).
            </p>
            <div className="flex items-center gap-3">
              <input
                id="referralDiscountPercent"
                name="referralDiscountPercent"
                type="number"
                min={1}
                max={100}
                step={0.5}
                required
                defaultValue={settings.referralDiscountPercent}
                className="w-28 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-purple focus:outline-none"
              />
              <span className="text-sm text-brand-muted">%</span>
            </div>
          </div>
        </>
      )}

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
