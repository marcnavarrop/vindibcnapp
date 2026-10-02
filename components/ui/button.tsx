import { clsx, TAP } from "@/lib/utils";

type Variant = "primary" | "attention" | "outline";

/*
 * `hover:` no existeix al mòbil: no hi ha ratolí, i entre que es toca i la
 * pantalla respon no passava res. `active:` sí que s'activa amb el dit, i és
 * el que fa que el botó se senti.
 *
 * Cada variant s'enfosqueix amb el seu propi to i no amb una opacitat general:
 * el lila sobre blanc i el blau sobre blanc no reaccionen igual, i abaixar
 * l'opacitat deixaria veure el fons a través del botó.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-purple text-white hover:bg-brand-purple-light active:bg-brand-purple-dark disabled:opacity-50",
  // Abans «accent», en taronja. Des del pas 7 el taronja és només dels grups:
  // el botó que mereix una mica més de compte (armar el mode PRE) va en el
  // blau d'atenció.
  attention:
    "bg-attention text-white hover:opacity-90 active:opacity-80 disabled:opacity-50",
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
        "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold tracking-wide uppercase",
        // El tacte surt de la constant compartida: els botons escrits a mà de
        // login i registre i les capçaleres de llistat fan servir la mateixa.
        TAP,
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
