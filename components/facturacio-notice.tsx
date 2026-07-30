/**
 * Avís que emmarca tota la secció: això és una calculadora interna, no un
 * emissor de documents fiscals. Apareix a totes les pestanyes a propòsit —
 * és el context sense el qual les xifres es podrien fer servir malament.
 */
export function FacturacioNotice() {
  return (
    <div className="mb-6 rounded-2xl border border-brand-orange/40 bg-brand-orange/5 p-4">
      <p className="text-xs font-bold tracking-wide text-brand-orange uppercase">
        Càlcul orientatiu, sense validesa fiscal
      </p>
      <p className="mt-1.5 text-sm text-brand-charcoal">
        Aquesta secció calcula quant correspon pagar a cada professional segons
        les sessions completades i les tarifes que hi definiu. No emet cap
        document amb validesa fiscal ni el substitueix.
      </p>
      <p className="mt-1.5 text-sm text-brand-charcoal">
        El marc fiscal aplicable —nòmina o factura d&apos;autònom, retencions
        d&apos;IRPF, IVA, cotitzacions— l&apos;ha de confirmar la gestoria o
        l&apos;assessor del centre abans de fer servir aquestes xifres per a
        pagaments reals.
      </p>
    </div>
  );
}
