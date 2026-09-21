"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS, SERVICE_TYPES, GROUP_CAPACITY } from "@/lib/labels";
import { createReservationAction } from "@/app/(admin)/admin/reservas/actions";
import { canRepeatInSeries } from "@/lib/series-rules";
import type { ReservationFormData } from "@/lib/data/reservations";
import type { FormState } from "@/app/(admin)/admin/clients/actions";
import type { ServiceType } from "@/types/database";
import { TAP } from "@/lib/utils";

export function ReservationForm({
  clients,
  trainers,
  action = createReservationAction,
  cancelHref,
  defaultScheduledAt,
  defaultTrainerId,
}: {
  clients: ReservationFormData["clients"];
  trainers: ReservationFormData["trainers"];
  /** Acción del formulario; por defecto la del área admin. */
  action?: (prev: FormState, formData: FormData) => Promise<FormState>;
  /**
   * On torna "Cancel·lar". SENSE VALOR PER DEFECTE a posta: aquest formulari
   * el fan servir dues àrees, i quan l'enllaç apuntava fix a l'agenda de
   * l'admin, el professional que el premia xocava contra el middleware i
   * acabava a la seva pantalla d'inici sense saber per què. Un valor per
   * defecte només hauria amagat el mateix error una mica millor.
   */
  cancelHref: string;
  /** Valor inicial de data i hora (YYYY-MM-DDTHH:mm), p. ej. desde el calendario. */
  defaultScheduledAt?: string;
  /**
   * Professional ja triat pel context: la franja del calendari quan n'assenyala
   * un de sol, o un mateix a l'àrea del professional.
   *
   * ES PRESELECCIONA, NO S'AMAGA
   *
   * El camp segueix sent visible i canviable. Amagar-lo trencaria els tres
   * casos on de debò cal triar —«+ Nova reserva» sense franja, una franja amb
   * dos professionals disponibles, i una franja fora de la disponibilitat de
   * tothom—, i bloquejar-lo impediria esmenar un clic tort. El que sobrava no
   * era el camp: era haver de tornar a DECIDIR una cosa ja decidida. Amb el
   * valor posat, deixa de ser una decisió i passa a ser una confirmació.
   */
  defaultTrainerId?: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [clientId, setClientId] = useState("");
  // Cortesia: es regala la sessió. El bo deixa de tenir sentit i el tipus de
  // servei, que amb bo sortia del bo, s'ha de dir a mà.
  const [complimentary, setComplimentary] = useState(false);
  const [bonoId, setBonoId] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType | "">("");

  const bonos = useMemo(
    () => clients.find((c) => c.id === clientId)?.bonos ?? [],
    [clients, clientId],
  );

  /**
   * De quin servei és aquesta reserva, vingui d'on vingui.
   *
   * Amb bo el diu el bo; amb cortesia el diu el desplegable, perquè llavors no
   * hi ha bo d'on treure'l. Fa falta saber-ho per una sola cosa: decidir si es
   * pot repetir cada setmana.
   */
  const selectedService: ServiceType | null = complimentary
    ? serviceType || null
    : (bonos.find((b) => b.id === bonoId)?.serviceType ?? null);

  // Les de grup no es repeteixen. El mecanisme d'aquí és més petit que el bucle
  // del client —un nombre acotat de setmanes, decidit pel centre, que no
  // s'allarga sol— però el motiu de fons és el mateix aforament, i tenir-ne una
  // que sí i una que no seria una excepció que algú hauria de recordar. La
  // regla viu a `lib/series-rules.ts` i la comparteixen els tres punts d'entrada.
  const canRepeat = selectedService === null || canRepeatInSeries(selectedService);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      <SelectField
        label="Client"
        name="clientId"
        placeholder="Tria un client"
        required
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        options={clients.map((c) => ({ value: c.id, label: c.name }))}
      />

      {/*
        La casella va ABANS del bo perquè és la que decideix si el bo hi pinta
        res. Marcada, el selector de bo desapareix —no s'amaga amb CSS: deixa
        d'existir, i per tant el formulari no pot enviar un bonoId residual— i
        al seu lloc surt el tipus de servei, que amb bo sortia del bo mateix.
      */}
      <label className="flex items-start gap-2 text-sm text-brand-charcoal">
        <input
          type="checkbox"
          name="complimentary"
          checked={complimentary}
          onChange={(e) => setComplimentary(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-purple"
        />
        <span>
          <span className="font-bold">Sessió de cortesia</span>
          <span className="block text-xs text-brand-muted">
            No consumeix cap sessió de bo. En grup ocupa plaça igual: el màxim de{" "}
            {GROUP_CAPACITY} es respecta.
          </span>
        </span>
      </label>

      {complimentary ? (
        <SelectField
          label="Tipus de servei"
          name="serviceType"
          placeholder="Tria un tipus de servei"
          required
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType | "")}
          options={SERVICE_TYPES.map((t) => ({
            value: t,
            label: SERVICE_LABELS[t],
          }))}
        />
      ) : (
        <SelectField
          label="Bo (es descomptarà una sessió)"
          name="bonoId"
          placeholder={
            !clientId
              ? "Tria abans un client"
              : bonos.length === 0
                ? "Aquest client no té bons disponibles"
                : "Tria un bo"
          }
          required
          disabled={bonos.length === 0}
          value={bonoId}
          onChange={(e) => setBonoId(e.target.value)}
          options={bonos.map((b) => ({
            value: b.id,
            label: `${SERVICE_LABELS[b.serviceType]} · ${b.remaining} sessions disponibles`,
          }))}
        />
      )}

      <SelectField
        label="Professional"
        name="trainerId"
        placeholder="Sense assignar"
        // Només si de debò és un dels professionals de la llista: això pot
        // arribar de la URL, i un valor inventat deixaria el desplegable
        // ensenyant la primera opció com si algú l'hagués triada.
        defaultValue={
          trainers.some((t) => t.id === defaultTrainerId) ? defaultTrainerId : ""
        }
        options={trainers.map((t) => ({ value: t.id, label: t.name }))}
      />

      <Field
        label="Data i hora"
        name="scheduledAt"
        type="datetime-local"
        required
        defaultValue={defaultScheduledAt}
      />

      {/* El camp DESAPAREIX per a les de grup, no es deshabilita: un camp
          deshabilitat encara s'envia buit i el servidor l'hauria d'interpretar.
          Sense camp, `repeatWeeks` no arriba i `createReservation` en fa una de
          sola, que és el que ha de passar. Mateix criteri que el selector de bo
          quan es marca «Sessió de cortesia». */}
      {canRepeat ? (
        <div>
          <Field
            label="Repeticions setmanals"
            name="repeatWeeks"
            type="number"
            min={1}
            max={52}
            defaultValue={1}
          />
          <p className="mt-1 text-xs text-brand-muted">
            Amb més d&apos;1, crea una reserva cada setmana a la mateixa hora
            {complimentary
              ? "."
              : " (consumeix una sessió per reserva)."}
          </p>
        </div>
      ) : (
        <p className="rounded-lg bg-brand-bg px-3 py-2 text-xs text-brand-muted">
          Les sessions de grup no es poden repetir cada setmana: una franja són{" "}
          {GROUP_CAPACITY} places i repetir-la en bucle les bloquejaria per a la
          resta. Si en cal més d&apos;una, es creen d&apos;una en una.
        </p>
      )}

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Reservant…">Crear reserva</SubmitButton>
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
