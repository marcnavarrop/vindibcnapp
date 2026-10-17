import Link from "next/link";
import { notFound } from "next/navigation";
import { getBaixaImpact } from "@/lib/data/professional-deactivation";
import { lastDataAccess } from "@/lib/data/data-access-log";
import { ProfessionalBaixaForm } from "@/components/forms/professional-baixa-form";
import { ReactivateProfessionalButton } from "@/components/reactivate-professional-button";
import { SERVICE_LABELS, formatDate, formatTime } from "@/lib/labels";
import { TAP } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * «Donar de baixa» un professional (0128): què en depèn, què li passarà a cada
 * cosa i la confirmació escrivint-ne el nom. Tot es resol en confirmar.
 */
export default async function BaixaProfessionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const impact = await getBaixaImpact(id);
  if (!impact || impact.professional.role !== "trainer") notFound();
  const p = impact.professional;
  const done = p.deactivatedAt ? await lastDataAccess(p.id, "professional_deactivated") : null;
  const when = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`;
  const day = (d: string) => formatDate(`${d}T12:00:00Z`);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link
        href={`/admin/entrenadors/${id}/edit`}
        className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
      >
        ← Tornar
      </Link>
      <h1 className="mt-1 text-2xl text-brand-dark">Donar de baixa · {p.fullName}</h1>

      {p.deactivatedAt ? (
        <section className="mt-6 rounded-2xl border border-brand-border bg-white p-5" data-baixa="ja-de-baixa">
          <p className="text-sm text-brand-charcoal">
            Està donat de baixa des del <strong>{formatDate(p.deactivatedAt)}</strong>: no pot entrar i no surt a
            l&apos;agenda ni als selectors.
          </p>
          {done?.details && (
            <p className="mt-2 text-sm break-words text-brand-muted" data-baixa-fet>
              {done.details}
            </p>
          )}
          <div className="mt-4">
            <ReactivateProfessionalButton id={p.id} name={p.fullName} />
          </div>
        </section>
      ) : (
        <>
          <div className="mt-3 rounded-2xl border border-brand-border bg-brand-bg/60 p-4 text-sm text-brand-charcoal">
            <p>
              <strong>Es desactiva, no s&apos;esborra.</strong> No podrà entrar, deixa de sortir a l&apos;agenda,
              als selectors i a /prova, i la seva disponibilitat ja no s&apos;ofereix. Es conserva tot el seu
              historial amb el seu nom (sessions, notes, liquidacions, bonus). Es pot reactivar.
            </p>
            {p.isDemo && <p className="mt-2 text-brand-muted">És un compte de demostració.</p>}
          </div>

          <Block
            title="Clients assignats"
            count={impact.clients.length}
            what="Passen al professional que triïs a sota, o es queden sense professional."
            empty="Cap client assignat."
            testid="clients"
          >
            {impact.clients.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </Block>

          <Block
            title="Reserves futures"
            count={impact.reservations.length}
            what="Es cancel·len en nom del centre: la sessió torna al bo de cada client i se li envia un correu. Si en vols passar alguna a un altre professional, fes-ho abans des de l'agenda."
            empty="Cap reserva futura."
            testid="reservations"
          >
            {impact.reservations.map((r) => (
              <li key={r.id}>
                {when(r.scheduledAt)} · {SERVICE_LABELS[r.serviceType]} · {r.clientName}
              </li>
            ))}
          </Block>

          <Block
            title="Sèries periòdiques"
            count={impact.series.length}
            what="Es tanquen: no se'n reservaran més sessions."
            empty="Cap sèrie activa."
            testid="series"
          >
            {impact.series.map((s) => (
              <li key={s.id}>{s.clientName}</li>
            ))}
          </Block>

          <Block
            title="Llistes d'espera"
            count={impact.waits.length}
            what="S'anul·len i s'avisa cada client per correu."
            empty="Ningú no l'espera."
            testid="waits"
          >
            {impact.waits.map((w) => (
              <li key={w.id}>
                {day(w.desiredDate)} · {w.desiredTime} · {SERVICE_LABELS[w.serviceType]} · {w.clientName}
              </li>
            ))}
          </Block>

          <Block
            title="Sessions de prova"
            count={impact.trials.length}
            what="S'anul·len i s'avisa la persona per correu."
            empty="Cap prova pendent."
            testid="trials"
          >
            {impact.trials.map((t) => (
              <li key={t.id}>
                {when(t.scheduledAt)} · {t.fullName}
              </li>
            ))}
          </Block>

          <ProfessionalBaixaForm
            id={p.id}
            name={p.fullName}
            clientCount={impact.clients.length}
            targets={impact.reassignTargets}
          />
        </>
      )}
    </main>
  );
}

function Block({
  title,
  count,
  what,
  empty,
  testid,
  children,
}: {
  title: string;
  count: number;
  what: string;
  empty: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-brand-border bg-white p-4" data-baixa-block={testid} data-count={count}>
      <h2 className="text-sm font-bold text-brand-dark">
        {title} <span className="text-brand-muted">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="mt-1 text-sm text-brand-muted">{empty}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-brand-muted">{what}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm break-words text-brand-charcoal">{children}</ul>
        </>
      )}
    </section>
  );
}
