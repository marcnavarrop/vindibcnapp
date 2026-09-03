"use client";

import { TAP } from "@/lib/utils";
/**
 * Una opció de mètode de pagament: icona, títol i una línia del que passarà.
 *
 * Viu aquí i no dins de cada formulari pel mateix motiu que `service-picker`:
 * la compra d'un bo i la d'un val de regal ofereixen exactament les mateixes
 * opcions, i amb una còpia a cada lloc el dia que se n'afegeixi una tercera
 * —o canviï una icona— un dels dos es quedaria enrere.
 *
 * El tractament visual és el de les targetes de tipus de servei: caixa
 * quadrada amb la icona sobre fons tenyit i el text al costat.
 */
export function PaymentMethodOption({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 rounded-xl border-2 border-brand-purple bg-white px-4 py-3 text-left transition-colors hover:bg-brand-purple/5 active:bg-brand-purple/10 ${TAP}`}
    >
      <span
        aria-hidden
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-bold text-brand-dark">{title}</span>
        <span className="text-xs text-brand-muted">{description}</span>
      </span>
    </button>
  );
}
