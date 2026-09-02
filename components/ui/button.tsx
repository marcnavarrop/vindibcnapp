import { clsx } from "@/lib/utils";

type Variant = "primary" | "accent" | "outline";

/*
 * `hover:` no existeix al mòbil: no hi ha ratolí, i entre que es toca i la
 * pantalla respon no passava res. `active:` sí que s'activa amb el dit, i és
 * el que fa que el botó se senti.
 *
 * Cada variant s'enfosqueix amb el seu propi to i no amb una opacitat general:
 * el lila sobre blanc i el taronja sobre blanc no reaccionen igual, i abaixar
 * l'opacitat deixaria veure el fons a través del botó.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-purple text-white hover:bg-brand-purple-light active:bg-brand-purple-dark disabled:opacity-50",
  accent:
    "bg-brand-orange text-white hover:opacity-90 active:bg-brand-orange-dark disabled:opacity-50",
  outline:
    "border border-brand-border bg-white text-brand-charcoal hover:bg-brand-bg active:bg-brand-border",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        // 100 ms: prou per no ser un salt sec i prou poc per sentir-se
        // immediat. Amb la durada per defecte (150 ms) el rebot arriba tard.
        // `active:scale-95` s'aplica també quan el botó està desactivat, i
        // allà no ha de passar res: `disabled:active:scale-100` ho atura.
        "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold tracking-wide uppercase",
        "transition-[background-color,border-color,opacity,transform] duration-100",
        "active:scale-95 disabled:active:scale-100",
        // Sense el destacat blau de toc d'iOS/Android: ja tenim el nostre.
        "[-webkit-tap-highlight-color:transparent] touch-manipulation",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
