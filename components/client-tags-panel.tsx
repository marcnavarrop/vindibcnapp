import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { TagToggleButton } from "@/components/forms/tag-toggle-button";
import type { ClientTag } from "@/lib/data/client-tags";

/**
 * Secció "Etiquetes" de la fitxa d'un client.
 *
 * Cada etiqueta és un formulari d'una casella: marcar-la l'assigna, desmarcar-la
 * la treu. Sense JS de client i sense botó de desar —el mateix criteri que les
 * altres accions de la fitxa (activar/desactivar un servei, treure un exercici),
 * que també són un `form` per fila.
 *
 * Dos permisos i no un, perquè són dues coses diferents (0068):
 *   · `canAssign` — marcar i desmarcar. L'admin i l'entrenador/a ASSIGNAT.
 *   · `canCreate` — crear etiquetes noves al catàleg. Només l'admin.
 *
 * Un entrenador/a assigna les que hi ha però no n'inventa; i davant d'un client
 * que no és seu, ni una cosa ni l'altra —la RLS ja l'aturaria, però ensenyar
 * caselles que reboten és pitjor que ensenyar-les apagades.
 */
export function ClientTagsPanel({
  allTags,
  assignedIds,
  toggleAction,
  createAction,
  canAssign,
  canCreate,
}: {
  allTags: ClientTag[];
  assignedIds: Set<string>;
  toggleAction: (formData: FormData) => void | Promise<void>;
  createAction?: (formData: FormData) => void | Promise<void>;
  canAssign: boolean;
  canCreate: boolean;
}) {
  const visibleTags = canAssign ? allTags : allTags.filter((t) => assignedIds.has(t.id));

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          Etiquetes
        </h2>
      </div>

      <p className="border-b border-brand-border px-5 py-3 text-sm text-brand-muted">
        Serveixen per dirigir ofertes a un grup de clients. El client no les veu.
      </p>

      {/*
        En només lectura no s'ensenya el catàleg sencer apagat: qui no pot tocar
        res només vol saber QUINES té aquest client, i la resta és soroll.
      */}
      {visibleTags.length === 0 ? (
        <p className="px-5 py-3 text-sm text-brand-muted">
          {canAssign
            ? "Encara no hi ha cap etiqueta al catàleg."
            : "Aquest client no té cap etiqueta."}
        </p>
      ) : (
        <div className="divide-y divide-brand-border">
          {visibleTags.map((t) => {
            const checked = assignedIds.has(t.id);
            return (
              <form
                key={t.id}
                action={toggleAction}
                className="flex items-center gap-3 px-5 py-3 text-sm"
              >
                <input type="hidden" name="tagId" value={t.id} />
                {/* El valor que s'envia és el CONTRARI del que es veu: el botó
                    demana el canvi, no l'estat actual. */}
                <input type="hidden" name="checked" value={String(!checked)} />
                <TagToggleButton name={t.name} checked={checked} canAssign={canAssign} />
                {checked && <Badge tone="info">Assignada</Badge>}
              </form>
            );
          })}
        </div>
      )}

      {canCreate && createAction && (
        <form
          action={createAction}
          className="flex flex-col gap-3 border-t border-brand-border p-5 sm:flex-row sm:items-end"
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
          {/* Mateix motiu que la casella: crear una etiqueta també va al servidor
              i tornava sense dir res mentrestant. */}
          <SubmitButton pendingLabel="Creant…">Crear i assignar</SubmitButton>
        </form>
      )}
    </section>
  );
}
