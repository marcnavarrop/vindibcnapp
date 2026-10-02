import { clsx, TAP } from "@/lib/utils";

/**
 * LES PESTANYES DE SECCIÓ: una sola forma per a les tres menes que hi havia
 * (les d'un grup del menú, les del client i les de dins d'una pantalla).
 *
 * Abans eren text gris sobre una tira blanca enganxada a dalt de tot, separada
 * del títol i del menú, i a 375 px «Vals de regal», «Referits» o «Sessions de
 * prova» quedaven fora sense cap avís. Ara són un selector dins de la columna
 * del contingut, a sobre del títol:
 *
 * - la activa, plena de lila i amb el text blanc;
 * - les altres, amb el gris de les pestanyes (AA, `--color-brand-tab`);
 * - si no caben, salten a una segona fila. Mai s'amaguen ni cal lliscar.
 *
 * Els FILTRES d'una llista no són això i no fan servir aquesta peça: vegeu
 * `FilterChips`.
 */
export function SectionTabsFrame({
  label,
  group,
  children,
  className,
}: {
  /** Per al lector de pantalla. */
  label: string;
  /**
   * El nom del grup tal com surt al menú («Bons i pagaments»), a sobre del
   * selector. Només a l'escriptori: al mòbil el menú ja ensenya cada grup amb
   * el seu nom, i aquí costaria 22 px a cada pantalla.
   */
  group?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // A l'escriptori, el nom del grup a l'esquerra del selector i a la mateixa
    // línia: en una línia a part feia baixar 24 px més totes les pàgines.
    <div className={clsx("lg:flex lg:items-center lg:gap-4", className ?? "mb-4 lg:mb-5")}>
      {group && (
        <p className="hidden text-xs font-bold tracking-widest text-brand-muted uppercase lg:block">
          {group}
        </p>
      )}
      <nav
        aria-label={label}
        className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-brand-border bg-white p-1"
      >
        {children}
      </nav>
    </div>
  );
}

/** Les classes d'una pestanya del selector, enllaç o botó. */
export function sectionTabClass(active: boolean): string {
  return clsx(
    "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold whitespace-nowrap lg:h-9",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple",
    TAP,
    active
      ? "bg-brand-purple text-white active:bg-brand-purple-dark"
      : "text-brand-tab hover:bg-brand-bg hover:text-brand-dark active:bg-brand-border",
  );
}

/**
 * El text d'una pestanya: el nom curt al mòbil, si en té, i el sencer a
 * l'escriptori. Ocultes amb `display:none`, el lector de pantalla només en
 * llegeix una.
 */
export function TabLabel({ label, short }: { label: string; short?: string }) {
  if (!short) return <>{label}</>;
  return (
    <>
      <span className="lg:hidden">{short}</span>
      <span className="hidden lg:inline">{label}</span>
    </>
  );
}
