"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  reassignClientTrainerAction,
  type AssignTrainerState,
} from "@/app/actions/client-assignment-actions";

/**
 * El desplegable per canviar l'entrenador assignat d'un client.
 *
 * Fa servir el mateix `SelectField` que la fitxa d'administració, però no
 * reaprofita el seu `ClientForm` sencer: aquell desa nom, correu, telèfon i les
 * NOTES CLÍNIQUES en un sol enviament, i posar-lo a la fitxa del professional
 * li donaria, de passada, l'edició de les dades de salut de clients que no són
 * seus. La peça que es comparteix és el camp; el formulari, no.
 */
export function AssignTrainerForm({
  clientId,
  trainers,
  currentTrainerId,
}: {
  clientId: string;
  trainers: { id: string; name: string }[];
  currentTrainerId: string | null;
}) {
  const [state, formAction] = useActionState(
    reassignClientTrainerAction,
    {} as AssignTrainerState,
  );
  const router = useRouter();
  /*
   * El desplegable el governa React, i no el navegador amb `defaultValue`.
   *
   * Amb `defaultValue` el valor només s'aplica en néixer el component: després
   * de desar, el refresc portava el professional nou a la resta de la fitxa
   * però el desplegable es quedava ensenyant l'anterior, que és precisament el
   * lloc on has de poder llegir qui hi ha ara.
   */
  const [trainerId, setTrainerId] = useState(currentTrainerId ?? "");
  useEffect(() => {
    setTrainerId(currentTrainerId ?? "");
  }, [currentTrainerId]);

  /*
   * El `revalidatePath` de l'acció buida la memòria del servidor, però la
   * pantalla que ja s'està veient no se n'assabenta: just després de desar, el
   * desplegable encara ensenyava l'entrenador d'abans fins que algú recarregava.
   * Això demana la versió nova, i de passada el nom que surt a la resta de la
   * fitxa queda al dia.
   */
  useEffect(() => {
    if (state.savedAt) router.refresh();
  }, [state.savedAt, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <SelectField
        label="Entrenador assignat"
        name="trainerId"
        value={trainerId}
        onChange={(e) => setTrainerId(e.target.value)}
        placeholder="Sense assignar"
        options={trainers.map((t) => ({ value: t.id, label: t.name }))}
      />
      <div className="flex items-center gap-3">
        <SubmitButton>Desar</SubmitButton>
        {state.error && <span className="text-sm text-error">{state.error}</span>}
        {state.savedAt && !state.error && (
          <span className="text-sm font-bold text-success">Desat ✓</span>
        )}
      </div>
    </form>
  );
}
