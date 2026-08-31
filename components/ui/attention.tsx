import Link from "next/link";
import { Icon } from "@/components/ui/home-icon";

/**
 * El plafó d'"Atenció immediata", compartit per l'inici de l'admin i el del
 * professional.
 *
 * Comparteixen la caixa i el criteri, no el contingut: l'admin hi té proves,
 * vals i referits; el professional només les seves proves. Qui el fa servir hi
 * posa les files.
 *
 * La regla que el defineix: si no hi ha res, NO es pinta. Un plafó d'atenció
 * immediata que gairebé sempre ensenya zeros deixa de mirar-se, i el dia que
 * hi hagi alguna cosa tampoc es veurà. Per això no hi ha estat buit.
 */
export function AttentionPanel({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-brand-orange/40 bg-brand-orange/5">
      <div className="flex items-center gap-2.5 border-b border-brand-orange/25 px-5 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
          <Icon name="alert" size={16} />
        </span>
        <h2 className="text-xs font-bold tracking-widest text-brand-orange uppercase">
          Atenció immediata
        </h2>
      </div>
      <ul className="divide-y divide-brand-orange/20">{children}</ul>
    </section>
  );
}

/** Una fila: què passa, quantes n'hi ha i on es resol. */
export function AttentionRow({
  title,
  detail,
  href,
  cta,
}: {
  title: string;
  detail: React.ReactNode;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-brand-dark">{title}</p>
        <p className="text-xs text-brand-muted">{detail}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 text-xs font-bold tracking-wide text-brand-orange uppercase hover:text-brand-dark"
      >
        {cta} →
      </Link>
    </li>
  );
}
