import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { listSettlements } from "@/lib/data/settlements";
import { DownloadInvoiceButton } from "@/components/forms/download-invoice-button";
import { SERVICE_LABELS, formatEur, formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

/**
 * Les factures del professional. Només lectura: aquí no es genera ni s'edita
 * res —això és cosa de l'administració—, només es consulten i es descarreguen
 * les que ja s'han emès.
 */
export default async function TrainerFacturesPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "trainer") redirect("/login");

  const settlements = (await listSettlements(viewer.id)).filter(
    (s) => s.invoicePath !== null,
  );

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Les meves factures</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Els períodes que l&apos;administració ja ha tancat, amb el detall de les
        sessions completades i el document per descarregar.
      </p>

      {settlements.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white p-5 text-sm text-brand-muted">
          Encara no tens cap factura. N&apos;apareixerà una aquí cada cop que
          l&apos;administració tanqui un període teu, i rebràs un correu quan
          passi.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {settlements.map((s) => (
            <li
              key={s.id}
              className="rounded-2xl border border-brand-border bg-white p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-bold text-brand-dark">
                    {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                  </p>
                  <p className="text-xs text-brand-muted">
                    Emesa el {formatDate(s.generatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-brand-purple">
                    {formatEur(s.totalAmount)}
                  </span>
                  <DownloadInvoiceButton settlementId={s.id} scope="trainer" />
                </div>
              </div>

              {s.breakdown.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-muted">
                  {s.breakdown.map((l) => (
                    <li key={l.serviceType}>
                      {l.sessions} × {SERVICE_LABELS[l.serviceType]}
                      {l.rate !== null && ` a ${formatEur(l.rate)}`} ={" "}
                      <span className="font-bold text-brand-charcoal">
                        {formatEur(l.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 rounded-2xl bg-brand-orange/10 p-4 text-xs text-brand-orange">
        Document provisional. El format oficial final es confirmarà amb
        l&apos;assessoria: de moment és el càlcul intern del centre sobre les
        teves sessions completades, no un document amb validesa fiscal.
      </p>
    </main>
  );
}
