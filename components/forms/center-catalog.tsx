"use client";

import { useActionState, useEffect, useState } from "react";
import { Field } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { TAP } from "@/lib/utils";
import type { Center } from "@/lib/data/centers";
import type { CenterFormState } from "@/lib/actions/centers-registry";

type Action = (
  prev: CenterFormState,
  fd: FormData,
) => Promise<CenterFormState>;

/**
 * Registre de centres: llistar, donar d'alta i reanomenar. Català fix, com la
 * resta de l'àrea d'administració.
 *
 * NO hi ha esborrar, i no és un oblit: la 0080 no té policy de delete. Un
 * centre escrit malament es reanomena.
 */
export function CenterCatalog({
  centers,
  createAction,
  renameAction,
}: {
  centers: Center[];
  createAction: Action;
  renameAction: Action;
}) {
  const [createState, create] = useActionState(createAction, {} as CenterFormState);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
        <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
          Centres
        </h2>
        {centers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-brand-muted">
            Encara no hi ha cap centre.
          </p>
        ) : (
          <div className="divide-y divide-brand-border">
            {centers.map((c) => (
              <CenterRow key={c.id} center={c} renameAction={renameAction} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Afegir un centre
        </h2>
        <form action={create} className="flex max-w-sm flex-col gap-4">
          <Field label="Nom del centre" name="name" required maxLength={80} />
          {createState.error && (
            <p className="text-sm text-error">{createState.error}</p>
          )}
          <div>
            <SubmitButton pendingLabel="Desant…">Afegir</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function CenterRow({
  center,
  renameAction,
}: {
  center: Center;
  renameAction: Action;
}) {
  const [editing, setEditing] = useState(false);
  const [state, rename] = useActionState(renameAction, {} as CenterFormState);

  // Tancar l'editor quan el desat ha anat bé.
  //
  // Va a un efecte i no a una condició dins del render: `state.ok` es queda a
  // true després del primer desat, així que comprovar-ho mentre es pinta
  // hauria tancat el formulari a l'instant cada vegada que algú el tornés a
  // obrir. L'efecte depèn de `state`, que és un objecte nou a cada resposta de
  // l'acció, de manera que només salta quan hi ha resposta nova.
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  return (
    <div className="px-5 py-3 text-sm">
      {editing ? (
        <form action={rename} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={center.id} />
          <input
            name="name"
            defaultValue={center.name}
            required
            maxLength={80}
            aria-label="Nom del centre"
            className="min-w-0 flex-1 rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
          <SubmitButton pendingLabel="Desant…">Desar</SubmitButton>
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>
            Cancel·lar
          </Button>
          {state.error && (
            <p className="w-full text-sm text-error">{state.error}</p>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold text-brand-dark">{center.name}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`ml-auto text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
          >
            Reanomenar
          </button>
        </div>
      )}
    </div>
  );
}
