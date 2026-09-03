"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";
import { TAP } from "@/lib/utils";

/**
 * La casella d'una etiqueta a la fitxa d'un client.
 *
 * Client component només per una raó: `useFormStatus`. El formulari i la
 * server action es queden al servidor, com abans; l'únic que baixa al
 * navegador és saber si l'enviament està en vol.
 *
 * PER QUÈ CALIA. Sense rodeta, entre el clic i el repintat la fila era
 * IDÈNTICA —194 ms mesurats en local amb l'almacén en memòria; a producció, amb
 * les set consultes que la fitxa refà després del `revalidatePath`, força més—.
 * I no era només incòmode: qui no veu resposta torna a clicar, i el segon clic
 * cau sobre un formulari amb el `checked` ocult JA invertit, o sigui que fa
 * l'acció CONTRÀRIA. Dos clics, efecte net zero, i la sensació que la casella
 * no va.
 *
 * `disabled` mentre està en vol és la meitat que ho arregla de debò: el segon
 * clic no arriba a sortir. La rodeta és la que evita que el segon clic arribi
 * a existir.
 */
export function TagToggleButton({
  name,
  checked,
  canAssign,
}: {
  name: string;
  /** Estat actual segons el servidor. El formulari ja envia el contrari. */
  checked: boolean;
  canAssign: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!canAssign || pending}
      aria-busy={pending}
      // Un botó que commuta un estat ha de dir-lo, no només pintar-lo: sense
      // això un lector de pantalla llegeix "VIP, botó" i prou.
      aria-pressed={checked}
      className={`flex flex-1 items-center gap-3 text-left disabled:cursor-default ${
        canAssign && !pending ? TAP : ""
      } ${pending ? "opacity-60" : ""}`}
    >
      {/*
        La rodeta ocupa el lloc EXACTE de la casella (h-4 w-4) perquè la fila no
        salti: el que es vol és que l'estat canviï, no que es mogui res.
      */}
      <span
        aria-hidden
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold ${
          pending
            ? "text-brand-purple"
            : `border text-white ${
                checked
                  ? "border-brand-purple bg-brand-purple"
                  : "border-brand-border bg-white"
              }`
        }`}
      >
        {pending ? <Spinner size={14} /> : checked ? "✓" : ""}
      </span>
      <span className={checked ? "font-bold text-brand-dark" : "text-brand-muted"}>
        {name}
      </span>
    </button>
  );
}
