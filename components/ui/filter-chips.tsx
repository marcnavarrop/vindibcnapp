import { clsx, TAP } from "@/lib/utils";

/**
 * ELS FILTRES D'UNA LLISTA: pastilles petites amb un rètol davant («Filtre:»,
 * «Mostra:»).
 *
 * No són pestanyes i no ho han de semblar. Una pestanya et porta a una altra
 * pantalla (`SectionTabsFrame`); un filtre només tria què es veu de la llista
 * que tens davant. Abans tenien la mateixa forma —una caixa blanca amb la
 * triada en lila— i a Bons se'n veien dues fileres seguides que semblaven el
 * mateix.
 */
export function FilterChips({
  label,
  prefix = "Filtre:",
  children,
  className,
}: {
  /** Per al lector de pantalla («Filtre d'estat»). */
  label: string;
  /** El rètol que es veu. */
  prefix?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={clsx("flex flex-wrap items-center gap-1.5", className ?? "mb-4")}>
      <span className="mr-0.5 text-xs font-bold tracking-wide text-brand-muted uppercase">{prefix}</span>
      {children}
    </nav>
  );
}

/** Les classes d'una pastilla de filtre, enllaç o botó. */
export function filterChipClass(active: boolean): string {
  return clsx(
    // 32 px, la mateixa alçada que tenien els filtres abans i més baixa que les
    // pestanyes a posta: a 40 px, els quatre filtres de Bons ocupaven tres
    // files al mòbil i baixaven la llista 97 px.
    "inline-flex h-8 items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-[13px] font-semibold whitespace-nowrap",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple",
    TAP,
    active
      ? "border-brand-purple bg-brand-purple/10 text-brand-purple"
      : "border-brand-border bg-white text-brand-charcoal hover:border-brand-purple/40",
  );
}

/** La marca de la triada: amb el color sol no n'hi ha prou. */
export function ChipCheck({ on }: { on: boolean }) {
  return on ? <span aria-hidden>✓</span> : null;
}
