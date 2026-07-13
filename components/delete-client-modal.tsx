"use client";

import { useActionState, useState } from "react";
import {
  deleteClientAction,
  type FormState,
} from "@/app/(admin)/admin/clients/delete-actions";

export function DeleteClientModal({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction] = useActionState(
    deleteClientAction.bind(null, clientId),
    {} as FormState,
  );

  const matches =
    typed.trim().toLowerCase() === clientName.trim().toLowerCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-lg border border-error/40 bg-white px-4 py-2 text-sm font-bold tracking-wide text-error uppercase transition-colors hover:bg-error/10"
      >
        Eliminar client
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-brand-dark">
              Eliminar {clientName}
            </h2>
            <p className="mt-2 text-sm text-brand-muted">
              Aquesta acció és <strong>irreversible</strong>. S&apos;esborraran
              totes les dades personals del client i el seu accés
              (autenticació). Els pagaments es conserven de forma anonimitzada
              per obligació fiscal.
            </p>
            <p className="mt-3 text-sm text-brand-charcoal">
              Per confirmar, escriu el nom complet del client:{" "}
              <strong>{clientName}</strong>
            </p>

            <form action={formAction} className="mt-3 flex flex-col gap-3">
              <input
                name="confirmName"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={clientName}
                className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-error"
              />
              {state.error && (
                <p className="text-sm text-error">{state.error}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!matches}
                  className="flex-1 rounded-lg bg-error px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Eliminar definitivament
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark"
                >
                  Cancel·lar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
