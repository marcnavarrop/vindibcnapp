"use client";

import { useSyncExternalStore } from "react";

/**
 * «ESBORRAT · DESFER»: l'avís que surt després d'esborrar el que es pot tornar a
 * posar tal com era (un registre de progrés, la nota d'una sessió, una franja
 * de disponibilitat sense reserves a sobre).
 *
 * Per què desfer i no preguntar: preguntar abans fa pagar un toc de més cada
 * vegada per protegir-se d'una equivocació que passa poc. Desfer només costa
 * quan t'has equivocat. Val per a allò que es pot refer EXACTAMENT; el que
 * arrossega altres dades o arriba a algú (un anunci, una oferta, un exercici
 * amb el seu progrés) segueix preguntant abans (`ConfirmInline`).
 *
 * Desfer no és cap porta nova: torna a CREAR el que s'ha esborrat amb la
 * mateixa acció d'alta de sempre, que mira qui la crida i què pot fer.
 *
 * Magatzem de mòdul i no estat de React: l'esborrat refresca la pàgina
 * (`revalidatePath`) i el component que l'ha fet pot desaparèixer amb la fila.
 * L'avís el pinta `UndoToaster`, que viu al marc (`AppShell`) i sobreviu.
 */
export type UndoToast = {
  id: number;
  /** «Registre esborrat». */
  message: string;
  /** Torna-ho a posar. `null` si ha anat bé; si no, el motiu. */
  undo: () => Promise<string | null>;
};

let current: UndoToast | null = null;
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function showUndo(t: Omit<UndoToast, "id">): void {
  current = { ...t, id: ++seq };
  emit();
}

export function clearUndo(id: number): void {
  if (current?.id === id) {
    current = null;
    emit();
  }
}

export function useUndoToast(): UndoToast | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
    () => null,
  );
}
