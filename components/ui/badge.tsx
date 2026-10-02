import {
  Banknote,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleX,
  CreditCard,
  Gift,
  Hourglass,
  Info,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "@/lib/utils";

/**
 * ELS TONS (pas 7 del pla d'UX)
 *
 * - `attention`: pendent o avís. El blau fosc de l'agenda, mai el taronja.
 * - `success`, `danger`: fet i perdut.
 * - `info`: dades en lila (categories, etiquetes, «Futura»).
 * - `neutral`: el que no demana res (mètode de pagament, completat).
 * - `new`: la novetat. Lila ple amb l'espurna: es diferencia d'`info` pel
 *   farciment i la icona.
 *
 * El taronja ja no és cap to: a tota l'app és només el color dels grups.
 */
export type BadgeTone = "success" | "neutral" | "danger" | "info" | "attention" | "new";

const TONES: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success",
  neutral: "bg-neutral-bg text-neutral-ink",
  danger: "bg-error-bg text-error",
  info: "bg-brand-purple/10 text-brand-purple",
  attention: "bg-attention-bg text-attention",
  new: "bg-brand-purple text-white",
};

/**
 * LA ICONA, PERQUÈ L'ESTAT NO DEPENGUI DEL COLOR
 *
 * En blanc i negre, el blau d'atenció, el vermell, el verd i el lila queden
 * tots entre el 19 % i el 43 % de gris: no els separa el to. Els separa la
 * icona. Per això els tres tons d'estat en porten una per defecte (`success`,
 * `danger`, `attention`), i qui en vol una altra la demana: «pending» per al
 * que espera un cobrament (el rellotge de sorra de la prova pendent, a
 * l'agenda). `info` i `neutral` no en porten si no se'ls demana: hi van
 * categories i etiquetes, que no són estats. `icon={null}` la treu.
 */
export type BadgeIcon = "pending" | "alert" | "check" | "x" | "info" | "cash" | "card" | "gift" | "calendar" | "new";

const ICONS: Record<BadgeIcon, LucideIcon> = {
  pending: Hourglass,
  alert: CircleAlert,
  check: CircleCheck,
  x: CircleX,
  info: Info,
  cash: Banknote,
  card: CreditCard,
  gift: Gift,
  calendar: CalendarClock,
  new: Sparkles,
};

const DEFAULT_ICON: Partial<Record<BadgeTone, BadgeIcon>> = {
  success: "check",
  danger: "x",
  attention: "alert",
  new: "new",
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
  icon,
  className = "",
  title,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Sense posar: la del to. `null`: cap. */
  icon?: BadgeIcon | null;
  /** Per als usos amb text de longitud no controlada: `max-w-full truncate`. */
  className?: string;
  /** El text sencer quan es talla amb `truncate`. */
  title?: string;
}) {
  const key = icon === undefined ? DEFAULT_ICON[tone] : icon;
  const Icon = key ? ICONS[key] : null;
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} data-badge-icon={key} />}
      {children}
    </span>
  );
}
