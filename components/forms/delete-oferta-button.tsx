"use client";

import { deleteOfertaAction } from "@/app/(admin)/admin/ofertes/actions";

export function DeleteOfertaButton({ id }: { id: string }) {
  return (
    <form
      action={deleteOfertaAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Segur que vols eliminar aquesta oferta? Aquesta acció no es pot desfer.",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs font-bold tracking-wide text-error uppercase hover:opacity-70"
      >
        Eliminar
      </button>
    </form>
  );
}
