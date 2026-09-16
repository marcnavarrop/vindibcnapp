import { clsx } from "@/lib/utils";

type Tone = "success" | "neutral" | "danger" | "info" | "warn";

const TONES: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  neutral: "bg-brand-muted/10 text-brand-muted",
  danger: "bg-error/10 text-error",
  info: "bg-brand-purple/10 text-brand-purple",
  warn: "bg-brand-orange/10 text-brand-orange",
};

/**
 * `whitespace-nowrap` NO ÉS COSMÈTIC
 *
 * Sense ell l'etiqueta es parteix quan la columna s'estreny, i llavors passen
 * dues coses: la píndola es dimensiona a la línia més llarga i les curtes es
 * queden a l'esquerra —el `text-align` s'hereta de la taula—, i la forma de
 * `rounded-full` amb `py-0.5`, pensada per a una sola línia, es converteix en
 * un rectangle arrodonit de tres. "Pendent de pagament" en una columna de
 * 140 px feia dues línies de 68 i 61 px dins d'una píndola de 108: el text
 * semblava descentrat perquè ho estava.
 *
 * Amb `nowrap` la píndola no es parteix i és la columna la que s'eixampla; les
 * taules ja tenen `min-w` i `overflow-x-auto`, així que el que passa és que la
 * taula es desplaça, que és el comportament que ja tenien.
 *
 * El `text-center` no fa res amb `nowrap` posat i s'hi queda igualment: és el
 * que sosté la forma si algun dia `truncate` o un `max-w` tornen a permetre
 * més d'una línia.
 *
 * ETIQUETES DE TEXT LLIURE
 *
 * Amb `nowrap`, un text prou llarg se'n surt del seu contenidor en comptes de
 * partir-se. Als estats no passa —el més llarg del sistema és "Anul·lat per
 * impagament"—, però les etiquetes de client les escriu l'admin i no tenen
 * sostre. Aquells dos usos hi afegeixen `max-w-full truncate` pel seu compte.
 */
export function Badge({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  /** Per als usos amb text de longitud no controlada: `max-w-full truncate`. */
  className?: string;
  /** El text sencer quan es talla amb `truncate`. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-center",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
