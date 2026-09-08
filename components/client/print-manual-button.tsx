"use client";

import { Printer } from "lucide-react";
import { TAP } from "@/lib/utils";

/**
 * "Descarregar PDF" — que en realitat és el diàleg d'impressió del navegador.
 *
 * Sense cap dependència nova a posta: generar un PDF al servidor hauria
 * significat mantenir una segona versió del manual (la de pantalla i la de
 * paper) que aniria divergint de la primera a cada canvi. Amb `window.print()`
 * el document és el mateix i el que canvia és només la fulla d'estil
 * (`@media print` a globals.css).
 *
 * El botó desapareix del paper: seria un botó imprès que no es pot prémer.
 */
export function PrintManualButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark print:hidden ${TAP}`}
    >
      <Printer className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
