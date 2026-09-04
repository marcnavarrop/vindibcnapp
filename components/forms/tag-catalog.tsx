"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { PendingTextButton } from "@/components/ui/pending-text-button";
import type { ClientTagWithUsage } from "@/lib/data/client-tags";
import type { TagFormState } from "@/app/(admin)/admin/etiquetes/actions";
import { TAP } from "@/lib/utils";

/**
 * Catàleg d'etiquetes: crear-ne, reanomenar-les i esborrar-les.
 *
 * Les tres accions comparteixen pantalla perquè són la mateixa feina i n'hi ha
 * poques. Cada fila és un formulari de reanomenar amb el seu botó d'esborrar al
 * costat, i el de dalt en crea de noves.
 */
export function TagCatalog({
  tags,
  createAction,
  renameAction,
  deleteAction,
}: {
  tags: ClientTagWithUsage[];
  createAction: (prev: TagFormState, fd: FormData) => Promise<TagFormState>;
  renameAction: (prev: TagFormState, fd: FormData) => Promise<TagFormState>;
  deleteAction: (prev: TagFormState, fd: FormData) => Promise<TagFormState>;
}) {
  const [createState, createFormAction] = useActionState(createAction, {});
  const [rowState, rowFormAction] = useActionState(renameAction, {});
  const [deleteState, deleteFormAction] = useActionState(deleteAction, {});

  const error = createState.error ?? rowState.error ?? deleteState.error;

  return (
    <div className="flex flex-col gap-6">
      <form
        action={createFormAction}
        className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-5 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
            Nova etiqueta
          </span>
          <input
            name="name"
            maxLength={40}
            required
            placeholder="ex. VIP, Empresa, Rehabilitació"
            className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-dark"
          />
        </label>
        <SubmitButton pendingLabel="Creant…" className="shrink-0 whitespace-nowrap">
          Crear
        </SubmitButton>
      </form>

      {error && (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      {tags.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no hi ha cap etiqueta. Crea&apos;n una amb el camp de dalt.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-border bg-white">
          <div className="divide-y divide-brand-border">
            {tags.map((t) => {
              // Les ofertes que hi apunten bloquegen l'esborrat: la FK de la 0069
              // és `restrict`. Es diu abans de prémer, no després de l'error.
              const inUseByPromotions = t.promotionNames.length > 0;
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm"
                >
                  <form
                    action={rowFormAction}
                    className="flex min-w-[14rem] flex-1 items-center gap-2"
                  >
                    <input type="hidden" name="id" value={t.id} />
                    <input
                      name="name"
                      defaultValue={t.name}
                      maxLength={40}
                      required
                      className="min-w-0 flex-1 rounded-lg border border-brand-border bg-white px-3 py-1.5 text-sm font-bold text-brand-dark"
                    />
                    <PendingTextButton
                      pendingLabel="Desant…"
                      className={`text-brand-purple hover:text-brand-orange disabled:opacity-50 ${TAP}`}
                    >
                      Desar
                    </PendingTextButton>
                  </form>

                  <Badge tone={t.clientCount > 0 ? "info" : "neutral"}>
                    {t.clientCount}{" "}
                    {t.clientCount === 1 ? "client" : "clients"}
                  </Badge>

                  {inUseByPromotions && (
                    <span
                      className="text-xs text-brand-orange"
                      title={t.promotionNames.join(", ")}
                    >
                      La fan servir {t.promotionNames.length}{" "}
                      {t.promotionNames.length === 1 ? "oferta" : "ofertes"}
                    </span>
                  )}

                  <form action={deleteFormAction} className="ml-auto">
                    <input type="hidden" name="id" value={t.id} />
                    <PendingTextButton
                      pendingLabel="Esborrant…"
                      disabled={inUseByPromotions}
                      title={
                        inUseByPromotions
                          ? "Hi ha ofertes dirigides a aquesta etiqueta. Canvia-les primer."
                          : undefined
                      }
                      className={`text-brand-muted hover:text-error disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-brand-muted ${TAP}`}
                    >
                      Esborrar
                    </PendingTextButton>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
