"use client";

import { useTransition } from "react";
import { showUndo } from "@/lib/undo-toast";

type Action = (formData: FormData) => unknown;

const toForm = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

/**
 * Esborra al primer toc i ofereix «Desfer» (vegeu `lib/undo-toast.ts`).
 *
 * `restore` és l'acció d'ALTA de sempre amb les dades del que s'esborra: desfer
 * no salta cap comprovació, torna a demanar el mateix permís que crear-ho.
 */
export function UndoableDelete({
  action,
  fields,
  restore,
  restoreFields,
  message,
  label,
  className,
  onDone,
}: {
  action: Action;
  fields: Record<string, string>;
  restore: Action;
  restoreFields: Record<string, string>;
  /** «Registre esborrat». */
  message: string;
  label: string;
  className: string;
  /** Després d'esborrar (p. ex., tancar l'editor de la nota). */
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await action(toForm(fields));
          onDone?.();
          showUndo({
            message,
            undo: async () => {
              const res = await restore(toForm(restoreFields));
              // Les accions d'alta amb estat tornen `{ error }` si no han pogut.
              const err = (res as { error?: unknown } | null | undefined)?.error;
              return typeof err === "string" && err ? err : null;
            },
          });
        })
      }
      className={className}
    >
      {pending ? "Esborrant…" : label}
    </button>
  );
}
