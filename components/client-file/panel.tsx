/**
 * Les peces de llista de la fitxa del client, compartides per l'administració i
 * el professional (abans, una còpia a cada pàgina).
 */

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border bg-brand-bg px-5 py-3">
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">{title}</h2>
        {action}
      </div>
      <div className="divide-y divide-brand-border">{children}</div>
    </section>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-3 text-sm text-brand-muted">{children}</p>;
}

/** El rètol d'una acció en text a la capçalera d'un panell («+ Afegir bo»). */
export const PANEL_ACTION =
  "text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline";
