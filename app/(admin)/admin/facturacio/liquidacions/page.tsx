import { GroupTabs } from "@/components/ui/group-tabs";
import { FACTURACIO_TABS } from "@/app/(admin)/admin/facturacio/tabs";
import { FacturacioNotice } from "@/components/facturacio-notice";
import { GenerateInvoiceButton } from "@/components/forms/generate-invoice-button";
import { DownloadInvoiceButton } from "@/components/forms/download-invoice-button";
import { listTrainers } from "@/lib/data/clients";
import { computeSettlement, listSettlements } from "@/lib/data/settlements";
import { SERVICE_LABELS, formatEur, formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** Primer i darrer dia d'un mes "YYYY-MM". */
function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function LiquidacionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    trainer?: string;
    month?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const trainers = await listTrainers();

  const trainerId =
    sp.trainer && trainers.some((t) => t.id === sp.trainer) ? sp.trainer : "";

  // Rang personalitzat si arriben les dues dates; si no, el mes indicat.
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const custom = isDay(sp.from) && isDay(sp.to) && sp.to >= sp.from;
  const { from, to } = custom
    ? { from: sp.from!, to: sp.to! }
    : monthRange(month);

  const [preview, settlements] = await Promise.all([
    trainerId ? computeSettlement(trainerId, from, to) : Promise.resolve(null),
    listSettlements(),
  ]);

  const trainerName = (id: string) =>
    trainers.find((t) => t.id === id)?.name ?? "—";

  return (
    <>
      <GroupTabs tabs={FACTURACIO_TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl text-brand-dark">Liquidacions</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Càlcul del que correspon a cada professional segons les sessions
          completades del període.
        </p>

        <FacturacioNotice />

        {/* ── Selector ────────────────────────────────────────────────────── */}
        <form
          method="get"
          className="mb-6 rounded-2xl border border-brand-border bg-white p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Professional
              </span>
              <select
                name="trainer"
                defaultValue={trainerId}
                className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              >
                <option value="">Tria un professional…</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Mes
              </span>
              <input
                type="month"
                name="month"
                defaultValue={custom ? "" : month}
                className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
            </label>
          </div>

          <p className="mt-4 mb-2 text-xs text-brand-muted">
            O bé un rang concret (té prioritat sobre el mes si l&apos;omples):
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Des de
              </span>
              <input
                type="date"
                name="from"
                defaultValue={custom ? from : ""}
                className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
                Fins a
              </span>
              <input
                type="date"
                name="to"
                defaultValue={custom ? to : ""}
                className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
          >
            Calcular
          </button>
        </form>

        {/* ── Resultat del càlcul ─────────────────────────────────────────── */}
        {preview && (
          <section className="mb-8 rounded-2xl border border-brand-border bg-white p-5">
            <h2 className="text-lg text-brand-dark">
              {trainerName(preview.trainerId)}
            </h2>
            <p className="mt-0.5 mb-4 text-sm text-brand-muted">
              Del {formatDate(from)} al {formatDate(to)}
            </p>

            {preview.lines.length === 0 ? (
              <p className="text-sm text-brand-muted">
                Cap sessió completada amb tarifa en aquest període.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-brand-border">
                  {preview.lines.map((l) => (
                    <li
                      key={l.serviceType}
                      className="flex items-baseline justify-between gap-3 py-2 text-sm"
                    >
                      <span className="text-brand-charcoal">
                        {l.sessions}{" "}
                        {l.sessions === 1 ? "sessió" : "sessions"}{" "}
                        {SERVICE_LABELS[l.serviceType]}
                        {l.rate !== null ? (
                          <span className="text-brand-muted">
                            {" "}
                            × {formatEur(l.rate)}
                          </span>
                        ) : (
                          <span className="text-brand-muted">
                            {" "}
                            (tarifes diferents dins del període)
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-bold text-brand-dark">
                        {formatEur(l.amount)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-brand-purple/30 pt-3">
                  <span className="text-sm font-bold tracking-wide text-brand-muted uppercase">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-brand-purple">
                    {formatEur(preview.total)}
                  </span>
                </div>
              </>
            )}

            {preview.unratedSessions > 0 && (
              <p className="mt-3 rounded-lg bg-brand-orange/10 p-3 text-xs text-brand-orange">
                {preview.unratedSessions === 1
                  ? "1 sessió completada no s'ha comptat"
                  : `${preview.unratedSessions} sessions completades no s'han comptat`}
                : no hi havia cap tarifa vigent per al seu servei el dia que es
                van fer.
              </p>
            )}

            {preview.lines.length > 0 && (
              <GenerateInvoiceButton
                trainerId={preview.trainerId}
                trainerName={trainerName(preview.trainerId)}
                periodStart={from}
                periodEnd={to}
                lines={preview.lines}
                total={preview.total}
                existingInvoice={settlements.some(
                  (s) =>
                    s.trainerId === preview.trainerId &&
                    s.periodStart === from &&
                    s.periodEnd === to,
                )}
              />
            )}
          </section>
        )}

        {/* ── Liquidacions ja generades ───────────────────────────────────── */}
        <h2 className="mb-1 text-lg text-brand-dark">Liquidacions generades</h2>
        <p className="mb-4 text-sm text-brand-muted">
          Cada una és una fotografia del càlcul del moment: no canvia encara que
          després es modifiquin les tarifes. El professional en veu la factura a
          la seva àrea.
        </p>

        {settlements.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white p-5 text-sm text-brand-muted">
            Encara no se n&apos;ha generat cap.
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
                      {trainerName(s.trainerId)}
                    </p>
                    <p className="text-xs text-brand-muted">
                      {formatDate(s.periodStart)} – {formatDate(s.periodEnd)} ·
                      generada el {formatDate(s.generatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-brand-purple">
                      {formatEur(s.totalAmount)}
                    </span>
                    {s.invoicePath ? (
                      <DownloadInvoiceButton settlementId={s.id} scope="admin" />
                    ) : (
                      <span className="text-xs text-brand-muted">
                        Sense factura
                      </span>
                    )}
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
      </main>
    </>
  );
}
