import type { Block, Chapter } from "@/lib/help/client-manual";

/**
 * El manual del client, pintat.
 *
 * Aquest fitxer no sap res del contingut: rep els capítols ja construïts
 * (lib/help/client-manual.ts) i els dibuixa. Per això no cal tocar-lo per
 * canviar una frase, i per això el mateix component servirà per als manuals del
 * professional i de l'administració quan arribin.
 *
 * És un component de SERVIDOR: el manual és text que no canvia mentre es
 * llegeix, i enviar-lo com a component de client hauria significat baixar tot
 * el document al navegador dues vegades (el marcatge i les dades). L'única peça
 * interactiva és el botó d'imprimir, que viu a part.
 *
 * `print-manual` és la classe amb què la fulla d'impressió (globals.css) el
 * reconeix, i `data-chapter` marca on pot començar un full nou.
 *
 * LES TRES CADENES QUE SÍ QUE SAP
 *
 * "No sap res del contingut" era gairebé cert: hi havia tres frases en català
 * escrites aquí dins —el títol de l'índex, la seva etiqueta d'accessibilitat i
 * el prefix dels avisos—. Amb els tres manuals en català no es notava; el dia
 * que el del client es tradueix, sí. Arriben per `labels`, amb el català per
 * defecte: el professional i l'administració no han de passar res, i el client
 * hi posa els seus.
 */
export type ManualLabels = {
  /** Títol de l'índex. */
  toc: string;
  /** Etiqueta d'accessibilitat de l'índex. */
  tocAria: string;
  /** Prefix en negreta dels blocs d'avís. Porta l'espai final. */
  warnPrefix: string;
};

const CA_LABELS: ManualLabels = {
  toc: "Què hi trobaràs",
  tocAria: "Índex del manual",
  warnPrefix: "Compte: ",
};

export function HelpManual({
  chapters,
  labels = CA_LABELS,
}: {
  chapters: Chapter[];
  labels?: ManualLabels;
}) {
  return (
    <div className="print-manual flex flex-col gap-10">
      <TableOfContents chapters={chapters} labels={labels} />

      {chapters.map((c, i) => (
        <section key={c.id} id={c.id} data-chapter className="scroll-mt-20">
          <h2 className="mb-4 border-b border-brand-border pb-2 text-xl font-bold text-brand-dark">
            <span className="mr-2 text-brand-purple">{i + 1}.</span>
            {c.title}
          </h2>
          <div className="flex flex-col gap-4">
            {c.blocks.map((b, j) => (
              <BlockView key={j} block={b} labels={labels} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * L'índex.
 *
 * Es queda al PDF a posta encara que els enllaços no s'hi puguin prémer: en
 * paper segueix fent de sumari, que és mitja feina d'un índex.
 */
function TableOfContents({
  chapters,
  labels,
}: {
  chapters: Chapter[];
  labels: ManualLabels;
}) {
  return (
    <nav
      aria-label={labels.tocAria}
      data-nobreak
      className="rounded-2xl border border-brand-border bg-white p-5"
    >
      <h2 className="mb-3 text-sm font-bold tracking-wide text-brand-muted uppercase">
        {labels.toc}
      </h2>
      <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {chapters.map((c, i) => (
          <li key={c.id} className="text-sm">
            <a
              href={`#${c.id}`}
              className="text-brand-charcoal hover:text-brand-purple"
            >
              <span className="mr-1.5 font-bold text-brand-purple">{i + 1}.</span>
              {c.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function BlockView({
  block: b,
  labels,
}: {
  block: Block;
  labels: ManualLabels;
}) {
  switch (b.t) {
    case "h":
      return (
        <h3 className="mt-2 text-base font-bold text-brand-dark">{b.text}</h3>
      );

    case "p":
      return <p className="text-sm leading-relaxed text-brand-charcoal">{b.text}</p>;

    case "ul":
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-brand-charcoal">
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-brand-charcoal">
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      );

    case "dl":
      return (
        <dl className="flex flex-col divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border">
          {b.items.map(([term, desc], i) => (
            <div key={i} data-nobreak className="px-4 py-2.5 text-sm">
              <dt className="font-bold text-brand-dark">{term}</dt>
              <dd className="mt-0.5 leading-relaxed text-brand-charcoal">
                {desc}
              </dd>
            </div>
          ))}
        </dl>
      );

    /* Els dos avisos es distingeixen pel color de la vora i prou: un fons ple
       cada tres paràgrafs faria el manual il·legible, i en paper encara més. */
    case "note":
      return (
        <aside className="rounded-xl border-l-4 border-brand-purple bg-brand-purple/5 px-4 py-3 text-sm leading-relaxed text-brand-charcoal">
          {b.text}
        </aside>
      );

    case "warn":
      return (
        <aside className="rounded-xl border-l-4 border-brand-orange bg-brand-orange/5 px-4 py-3 text-sm leading-relaxed text-brand-charcoal">
          <span className="font-bold">{labels.warnPrefix}</span>
          {b.text}
        </aside>
      );

    case "table":
      return (
        // La taula dels correus té tres columnes i no cap en un mòbil: es
        // desplaça ella sola, sense arrossegar la pàgina sencera.
        <div className="overflow-x-auto rounded-xl border border-brand-border">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-brand-bg">
                {b.head.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-brand-border px-4 py-2 text-xs font-bold tracking-wide text-brand-muted uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i} className="border-b border-brand-border last:border-0">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={
                        j === 0
                          ? "px-4 py-2.5 font-bold text-brand-dark"
                          : "px-4 py-2.5 text-brand-charcoal"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
