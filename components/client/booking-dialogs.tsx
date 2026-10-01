"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { clsx, TAP } from "@/lib/utils";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { CENTER_TZ } from "@/lib/config";
import type { ServiceType } from "@/types/database";
import type { ReservaErrorCode } from "@/app/(client)/client/reservas/waitlist-actions";
import type { FormState } from "@/app/(client)/client/reservas/actions";
import { ClientAddToCalendarButton } from "@/components/client/client-add-to-calendar-button";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { AnimatedFeedback } from "@/components/ui/animated-feedback";
import { WeeklyRepeat, type WeeklySeed } from "@/components/client/weekly-repeat";
import { canRepeatInSeries } from "@/lib/series-rules";
import {
  joinWaitlistAction,
  leaveWaitlistAction,
  type WaitlistState,
} from "@/app/(client)/client/reservas/waitlist-actions";
import { canCancelAt } from "@/lib/cancellation";
import { CenterContactLine } from "@/components/center-contact-line";

/**
 * Els diàlegs de reservar, de la teva sessió i de la cua.
 *
 * Viuen a part des de C2 perquè els fan servir les dues pantalles de Reserves
 * del client: la llista nova (mòbil) i la graella (escriptori, fins a C3). Una
 * sola còpia vol dir que reservar, cancel·lar i fer cua es comporten igual a
 * totes dues.
 *
 * Al mòbil s'obren com una fulla des de baix (el polze hi arriba) i tots els
 * botons fan com a mínim 44 px d'alt.
 */

/** Primer nom (per a la vista compacta). */
const firstName = (name: string) => name.split(" ")[0];

/** Dia i hora, sempre en hora del centre: qui reserva des de fora també veu la d'aquí. */
function useWhen(at: Date | string) {
  const locale = useLocale() as Locale;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CENTER_TZ,
  }).format(new Date(at));
}

const BTN = "min-h-11 rounded-lg px-3 py-2 text-sm font-bold";
const PRIMARY = `${BTN} bg-brand-purple text-white hover:bg-brand-purple-light active:bg-brand-purple-dark disabled:opacity-60`;
const QUIET = `${BTN} text-brand-muted hover:text-brand-dark active:bg-brand-bg ${TAP}`;

export type CreateAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;
/**
 * L'acció de cancel·lar, tal com la torna de veritat.
 *
 * Deia `{ error?: string }` mentre que l'acció torna `{ errorCode }`. Com que
 * totes dues tenen les propietats opcionals, TypeScript ho donava per bo i el
 * diàleg llegia un `state.error` que no existia mai: cap error d'aquesta
 * pantalla s'ha arribat a veure. Ara el tipus diu el que passa.
 */
export type CancelState = {
  errorCode?: ReservaErrorCode;
  errorHours?: number;
  ok?: boolean;
};

export type CancelAction = (
  prev: CancelState,
  formData: FormData,
) => Promise<CancelState>;

/**
 * Sessió de grup completa: apuntar-se a la cua o donar-se de baixa.
 *
 * Fins ara una sessió plena era un carreró sense sortida —deia "Complet" i
 * fins aquí—, i la cua només existia dins de l'assistent de sèries. És la
 * mateixa taula i la mateixa promoció: aquesta entrada simplement no té sèrie.
 */
export function WaitlistModal({
  trainerName: trainerNameFull,
  slot,
  trainerId,
  service = "grupo_reducido",
  entryId,
  notice,
  onClose,
  onDone,
}: {
  trainerName: string;
  slot: Date;
  trainerId: string;
  /**
   * El servei de la sessió. Per apuntar-se des de la llista d'hores només és
   * grup; per donar-se de baixa des de «A la cua» pot ser qualsevol, també una
   * espera d'una sèrie individual.
   */
  service?: ServiceType;
  /** Ja hi és a la cua? Llavors el que s'ofereix és la baixa. */
  entryId: string | null;
  /** Per què aquesta espera no podrà entrar, si és el cas (avís ambre). */
  notice?: React.ReactNode;
  onClose: () => void;
  onDone: () => void;
}) {
  const [joinState, join] = useActionState(joinWaitlistAction, {} as WaitlistState);
  const [leaveState, leave] = useActionState(leaveWaitlistAction, {} as WaitlistState);

  const t = useTranslations("reservas");
  const tl = useTranslations("labels.service");
  const te = useTranslations("reservas.errors");
  const when = useWhen(slot);

  if (joinState.ok)
    return (
      <Overlay onClose={onDone} label={t("waitlist.joinedTitle")}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <AnimatedFeedback type="success" />
          <h2 className="text-xl font-bold text-brand-dark">
            {t("waitlist.joinedTitle")}
          </h2>
          <p className="text-sm text-brand-muted">
            {t("waitlist.joinedBody")}
          </p>
          <p className="text-sm font-bold text-brand-dark first-letter:uppercase">{when}</p>
        </div>
        <button type="button" onClick={onDone} className={`mt-5 w-full ${PRIMARY} ${TAP}`}>
          {t("close")}
        </button>
      </Overlay>
    );

  if (leaveState.ok)
    return (
      <Overlay onClose={onDone} label={t("waitlist.leftTitle")}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <AnimatedFeedback type="cancel" />
          <h2 className="text-xl font-bold text-brand-dark">
            {t("waitlist.leftTitle")}
          </h2>
          <p className="text-sm text-brand-muted">
            {t("waitlist.leftBody")}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className={`mt-5 w-full ${BTN} bg-error/10 text-error hover:bg-error/20 active:bg-error/30 ${TAP}`}
        >
          {t("close")}
        </button>
      </Overlay>
    );

  const title = entryId ? t("waitlist.onListTitle") : t("waitlist.fullTitle");
  return (
    <Overlay onClose={onClose} label={title}>
      <h2 className="text-lg font-bold text-brand-dark">{title}</h2>
      <p className="mt-1 text-sm text-brand-muted first-letter:uppercase">{when}</p>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <Field label={t("service")} value={tl(service)} />
        <Field label={t("professional")} value={firstName(trainerNameFull)} />
      </dl>

      {entryId ? (
        <>
          {notice ? (
            <p
              data-testid="wait-notice"
              className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {notice}
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-charcoal">
              {t("waitlist.onListBody")}
            </p>
          )}
          <form action={leave} className="mt-5">
            <input type="hidden" name="entryId" value={entryId} />
            {leaveState.errorCode && (
              <p className="mb-3 text-sm text-error">{te(leaveState.errorCode)}</p>
            )}
            <PendingSubmit
              pendingLabel={t("waitlist.leaving")}
              className={`w-full ${BTN} border border-brand-border text-error hover:bg-error/10 active:bg-error/20 disabled:opacity-60`}
            >
              {t("waitlist.leave")}
            </PendingSubmit>
          </form>
        </>
      ) : (
        <>
          <p className="mt-4 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-charcoal">
            {t("waitlist.fullBody")}
          </p>
          <form action={join} className="mt-5">
            <input type="hidden" name="trainerId" value={trainerId} />
            <input type="hidden" name="serviceType" value={service} />
            <input type="hidden" name="scheduledAt" value={slot.toISOString()} />
            {joinState.errorCode && (
              <p className="mb-3 text-sm text-error">{te(joinState.errorCode)}</p>
            )}
            <PendingSubmit pendingLabel={t("waitlist.joining")} className={`w-full ${PRIMARY}`}>
              {t("waitlist.join")}
            </PendingSubmit>
          </form>
        </>
      )}

      <button type="button" onClick={onClose} className={`mt-3 w-full ${QUIET}`}>
        {t("close")}
      </button>
    </Overlay>
  );
}

/**
 * Els companys d'una sessió de grup.
 *
 * NOMÉS es fa servir als diàlegs de detall, mai a la graella ni a la llista:
 * el que es veu de lluny i sense voler-ho és el comptador, i qui hi ha apuntat
 * és cosa de qui obre la sessió.
 *
 * No pinta res si la llista és buida, que és el cas de TOTS els serveis que no
 * són 'grupo_reducido': el servidor no els hi envia mai cap nom (vegeu
 * `mateName` a lib/data/client-calendar.ts).
 */
function GroupMates({ mates, label }: { mates: string[]; label: string }) {
  if (mates.length === 0) return null;
  return <Field label={label} value={mates.join(", ")} />;
}

/**
 * Confirmar una reserva.
 *
 * Des de C2 diu quin bo es gasta i quantes sessions hi quedaran, i quan la
 * mateixa hora la poden fer diversos professionals (fisio), deixa triar-ne un
 * aquí mateix en comptes d'obrir una altra pantalla.
 */
export function CreateModal({
  trainerId: initialTrainerId,
  otherPartyName: trainerNameFull,
  trainerOptions,
  service,
  slot,
  mates = [],
  remainingSessions,
  subscriptionServiceType,
  waitlistEnabled = false,
  action,
  onClose,
  onDone,
}: {
  trainerId: string;
  otherPartyName: string;
  /**
   * Si la mateixa hora la poden fer diversos professionals, tots ells: el
   * client tria aquí. El primer és el que ve triat.
   */
  trainerOptions?: { id: string; name: string }[];
  service: ServiceType;
  slot: Date;
  /** Companys de grup ja apuntats. Sempre buit si no és 'grupo_reducido'. */
  mates?: string[];
  remainingSessions?: number;
  /** De quin servei és la subscripció viva del client, si en té (0072/0086). */
  subscriptionServiceType?: ServiceType | null;
  /** El centre accepta inscripcions noves a la cua (opció de la sèrie). */
  waitlistEnabled?: boolean;
  action: CreateAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const [trainerId, setTrainerId] = useState(initialTrainerId);
  const chosen = trainerOptions?.find((o) => o.id === trainerId);
  const chosenFull = chosen?.name ?? trainerNameFull;
  const trainerName = firstName(chosenFull);
  // La sèrie es repeteix amb qui s'hagi triat, no amb el primer de la llista.
  // Només els serveis que es poden repetir (`canRepeatInSeries`): un grup no.
  const weeklySeed: WeeklySeed | undefined = canRepeatInSeries(service)
    ? { scheduledAt: slot.toISOString(), trainerId, serviceType: service }
    : undefined;
  const [recurrent, setRecurrent] = useState(false);
  const [state, formAction] = useActionState(action, {} as FormState);
  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useTranslations("reservas");
  const tl = useTranslations("labels.service");
  const te = useTranslations("reservas.errors");
  const when = useWhen(slot);

  if (state.ok) {
    return (
      <Overlay onClose={onDone} label={t("book.confirmed")}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <AnimatedFeedback type="success" />
          <h2 className="text-xl font-bold text-brand-dark">
            {t("book.confirmed")}
          </h2>
          <p className="text-sm text-brand-muted first-letter:uppercase">{when}</p>
        </div>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Field label={t("service")} value={tl(service)} />
          <Field label={t("professional")} value={trainerName} />
          <GroupMates mates={mates} label={t("book.with")} />
        </dl>
        <div className="mt-5 flex flex-col items-center gap-3">
          <ClientAddToCalendarButton
            touch
            serviceType={service}
            otherPartyName={trainerName}
            scheduledAt={slot.toISOString()}
          />
          <button type="button" onClick={onDone} className={`w-full ${QUIET}`}>
            {t("close")}
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose} label={t("book.confirmTitle")}>
      <h2 className="text-lg font-bold text-brand-dark">{t("book.confirmTitle")}</h2>
      <p className="mt-1 text-base font-bold text-brand-dark first-letter:uppercase">{when}</p>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <Field label={t("service")} value={tl(service)} />
        {!trainerOptions || trainerOptions.length < 2 ? (
          <Field label={t("professional")} value={trainerName} />
        ) : null}
        <GroupMates mates={mates} label={t("book.alreadyJoined")} />
      </dl>

      {trainerOptions && trainerOptions.length > 1 && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm text-brand-muted">{t("book.chooseTrainer")}</legend>
          <div className="flex flex-wrap gap-2">
            {trainerOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={o.id === trainerId}
                onClick={() => setTrainerId(o.id)}
                className={clsx(
                  "min-h-11 rounded-full border px-4 text-sm font-bold",
                  TAP,
                  o.id === trainerId
                    ? "border-brand-purple bg-brand-purple text-white"
                    : "border-brand-border bg-white text-brand-charcoal active:bg-brand-bg",
                )}
              >
                {firstName(o.name)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* El bo que es gasta, dit abans de gastar-lo. */}
      {typeof remainingSessions === "number" && remainingSessions > 0 && (
        <p
          data-testid="bono-line"
          className="mt-4 rounded-lg bg-brand-bg px-3 py-2 text-sm text-brand-charcoal"
        >
          {t("book.spends", { left: remainingSessions - 1 })}
        </p>
      )}

      {/* Repetir-la és la mateixa decisió que fer-la, i per això es plega
          aquí sota en comptes d'obrir una altra superfície. */}
      {weeklySeed && (
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-brand-border px-3 py-2">
          <input
            type="checkbox"
            checked={recurrent}
            onChange={(e) => setRecurrent(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-brand-purple"
          />
          <span className="text-sm font-bold text-brand-charcoal">
            {t("repeat.toggle")}
          </span>
        </label>
      )}

      {/* Un sol botó primari a cada moment: o reserves aquesta, o mires com
          quedarien les setmanes. Mai els dos alhora. */}
      {recurrent && weeklySeed ? (
        <WeeklyRepeat
          key={trainerId}
          seed={weeklySeed}
          subscriptionServiceType={subscriptionServiceType}
          waitlistEnabled={waitlistEnabled}
          onBack={() => setRecurrent(false)}
          onDone={onDone}
        />
      ) : (
        <form action={formAction} className="mt-5">
          <input type="hidden" name="trainerId" value={trainerId} />
          <input type="hidden" name="serviceType" value={service} />
          <input type="hidden" name="scheduledAt" value={slot.toISOString()} />
          {state.errorCode && (
            <p className="mb-3 text-sm text-error">{te(state.errorCode, { hours: state.errorHours ?? 0 })}</p>
          )}
          <div className="flex items-center gap-2">
            {/* Mentre la reserva viatja al servidor hi havia uns segons sense
                cap senyal, i convidaven a tornar a clicar. Ara el botó ho diu i
                es bloqueja, que és el que evita la reserva doble. */}
            <PendingSubmit pendingLabel={t("book.submitting")} className={`flex-1 ${PRIMARY}`}>
              {t("book.submit")}
            </PendingSubmit>
            <button type="button" onClick={onClose} className={QUIET}>
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </Overlay>
  );
}

/**
 * Una sessió teva: afegir-la al calendari, repetir-la o cancel·lar-la.
 *
 * `startConfirming` obre directament la pregunta de cancel·lar: és el que fa el
 * botó «Cancel·lar» de la capçalera, perquè cancel·lar costi dos tocs.
 */
export function OwnModal({
  service,
  otherPartyName: trainerNameFull,
  id,
  scheduledAt,
  mates = [],
  minCancellationHours,
  cancelAction,
  trainerId,
  subscriptionServiceType,
  waitlistEnabled = false,
  startConfirming = false,
  onClose,
}: {
  service: ServiceType;
  otherPartyName: string;
  id: string;
  scheduledAt: string;
  /** Companys de grup. Sempre buit si no és 'grupo_reducido'. */
  mates?: string[];
  minCancellationHours: number;
  cancelAction: CancelAction;
  /** Amb qui és, per poder-la repetir cada setmana. */
  trainerId: string | null;
  /** De quin servei és la subscripció viva del client, si en té (0072/0086). */
  subscriptionServiceType?: ServiceType | null;
  /** El centre accepta inscripcions noves a la cua (opció de la sèrie). */
  waitlistEnabled?: boolean;
  startConfirming?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("reservas");
  const tl = useTranslations("labels.service");
  const te = useTranslations("reservas.errors");
  const router = useRouter();
  const [state, action] = useActionState(cancelAction, {});
  const [confirming, setConfirming] = useState(startConfirming);
  const [cancelled, setCancelled] = useState(false);
  const [recurrent, setRecurrent] = useState(false);
  useEffect(() => {
    if (state.ok) setCancelled(true);
  }, [state.ok]);
  const canCancel = canCancelAt(scheduledAt, minCancellationHours);
  const when = useWhen(scheduledAt);
  // Repetir-la cada setmana a partir d'aquesta: la sessió s'adopta a la sèrie
  // (`ja_reservada`) i no es torna a reservar.
  const weeklySeed: WeeklySeed | undefined =
    trainerId && canRepeatInSeries(service)
      ? { scheduledAt, trainerId, serviceType: service }
      : undefined;

  if (cancelled) {
    const close = () => { router.refresh(); onClose(); };
    return (
      <Overlay onClose={close} label={t("own.cancelledTitle")}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <AnimatedFeedback type="cancel" />
          <h2 className="text-xl font-bold text-brand-dark">{t("own.cancelledTitle")}</h2>
          <p className="text-sm text-brand-muted">{t("own.cancelledBody")}</p>
        </div>
        <button
          type="button"
          onClick={close}
          className={`mt-5 w-full ${BTN} bg-error/10 text-error hover:bg-error/20 active:bg-error/30 ${TAP}`}
        >
          {t("close")}
        </button>
      </Overlay>
    );
  }

  const trainerName = firstName(trainerNameFull);

  return (
    <Overlay onClose={onClose} label={t("own.mySession")}>
      <h2 className="text-lg font-bold text-brand-dark">{t("own.mySession")}</h2>
      <p className="mt-1 text-base font-bold text-brand-dark first-letter:uppercase">{when}</p>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <Field label={t("service")} value={tl(service)} />
        <Field label={t("professional")} value={trainerName} />
        <GroupMates mates={mates} label={t("own.withYou")} />
      </dl>
      {!confirming && (
        <div className="mt-4">
          <ClientAddToCalendarButton
            touch
            serviceType={service}
            otherPartyName={trainerNameFull}
            scheduledAt={scheduledAt}
          />
        </div>
      )}
      {/* Repetir una sessió que ja tens és, de fet, el moment natural de
          voler-ho: primer reserves i després penses que la vols cada setmana.
          La sessió d'aquí s'adopta a la sèrie amb el seu `series_id` (vegeu
          `ja_reservada`), de manera que no es duplica ni es queda fora quan es
          cancel·li la sèrie sencera. */}
      {weeklySeed && !recurrent && !confirming && (
        <button
          type="button"
          onClick={() => setRecurrent(true)}
          className={`mt-4 flex w-full items-center justify-center gap-2 ${BTN} border-2 border-brand-purple text-brand-purple transition-colors hover:bg-brand-purple/5 active:bg-brand-purple/10 ${TAP}`}
        >
          {t("repeat.toggle")}
        </button>
      )}
      {/* Mentre s'està configurant la repetició, la cancel·lació desapareix:
          "Cancel·lar reserva" just sota de "Veure les sessions" és massa fàcil
          de prémer per error, i són dues coses oposades. */}
      {recurrent && weeklySeed && (
        <WeeklyRepeat
          seed={weeklySeed}
          subscriptionServiceType={subscriptionServiceType}
          waitlistEnabled={waitlistEnabled}
          onBack={() => setRecurrent(false)}
          onDone={() => {
            router.refresh();
            onClose();
          }}
        />
      )}
      {!recurrent &&
        (canCancel ? (
          confirming ? (
            <>
              <p className="mt-5 text-sm font-bold text-brand-dark">
                {t("own.confirmCancel")}
              </p>
              <div className="mt-3 flex gap-2">
                <form action={action} className="flex-1">
                  <input type="hidden" name="id" value={id} />
                  <PendingSubmit
                    pendingLabel={t("own.cancelling")}
                    className={`w-full ${BTN} bg-error text-white hover:opacity-80 active:opacity-70 disabled:opacity-60`}
                  >
                    {t("own.yesCancel")}
                  </PendingSubmit>
                </form>
                <button
                  type="button"
                  onClick={() => (startConfirming ? onClose() : setConfirming(false))}
                  className={`flex-1 ${BTN} border border-brand-border text-brand-muted hover:text-brand-dark active:bg-brand-bg ${TAP}`}
                >
                  {t("own.noBack")}
                </button>
              </div>
              {state.errorCode && (
                <p className="mt-2 text-xs text-error">
                  {te(state.errorCode, { hours: state.errorHours ?? 0 })}
                </p>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`mt-5 w-full ${BTN} border border-brand-border text-error hover:bg-error/10 active:bg-error/20 ${TAP}`}
            >
              {t("own.cancelBooking")}
            </button>
          )
        ) : (
          <div className="mt-5 rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-muted">
            <p>{t("own.tooLate", { hours: minCancellationHours })}</p>
            <CenterContactLine className="mt-1 text-xs" />
          </div>
        ))}
      {!confirming && !recurrent && (
        <button type="button" onClick={onClose} className={`mt-3 w-full ${QUIET}`}>
          {t("close")}
        </button>
      )}
    </Overlay>
  );
}

/**
 * El marc dels diàlegs: al mòbil, una fulla que puja des de baix; a partir de
 * `sm`, una finestra al mig.
 */
export function Overlay({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  /** El nom del diàleg per als lectors de pantalla. */
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* max-w-md i no sm: amb els camps de repetició plegats a dins, el
          diàleg de 384 px es quedava estret. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-brand-muted">{label}</dt>
      <dd className="font-bold text-brand-dark">{value}</dd>
    </div>
  );
}
