import Link from "next/link";
import { Icon } from "@/components/ui/home-icon";
import { TAP } from "@/lib/utils";

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
export function AttentionPanel({
  children,
  title = "Atenció immediata",
  count,
}: {
  children: React.ReactNode;
  /** «Per resoldre» a l'admin, «Per fer» al professional. */
  title?: string;
  /** Quantes coses demanen feina, al costat del títol. */
  count?: number;
}) {
  return (
    // El gris de sempre (#777) fa 3,9:1 sobre aquest fons: a dins es llegeix en
    // el gris de les pestanyes, que en fa 5,8.
    <section className="overflow-hidden rounded-2xl border-2 border-attention/25 bg-attention-bg [&_.text-brand-muted]:text-brand-tab">
      <div className="flex items-center gap-2.5 border-b border-attention/25 px-5 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-attention/10 text-attention">
          <Icon name="alert" size={16} />
        </span>
        <h2 className="text-xs font-bold tracking-widest text-attention uppercase">
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-attention px-2 text-xs font-bold text-white">
            {count}
          </span>
        )}
      </div>
      <ul className="divide-y divide-attention/15">{children}</ul>
    </section>
  );
}

/** Una fila: què passa, quantes n'hi ha i on es resol. */
export function AttentionRow({
  title,
  detail,
  href,
  cta,
  action,
}: {
  title: string;
  detail: React.ReactNode;
  href: string;
  cta: string;
  /**
   * En lloc de l'enllaç, un control propi (p. ex. «Marcar feta», que resol
   * aquí mateix sense anar enlloc).
   */
  action?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-brand-dark">{title}</p>
        <p className="text-xs text-brand-muted">{detail}</p>
      </div>
      {action ?? (
        // Un botó de debò (44 px d'alt) i no un enllaç de text: és l'acció
        // que resol la fila, i al mòbil s'ha de poder tocar sense apuntar.
        <Link
          href={href}
          className={`inline-flex min-h-10 shrink-0 items-center rounded-lg bg-attention px-3 text-xs font-bold text-white hover:bg-brand-dark ${TAP}`}
        >
          {cta}
        </Link>
      )}
    </li>
  );
}
