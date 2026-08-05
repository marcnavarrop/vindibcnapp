import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/data/dashboard";
import { formatEur, formatLongDate, SERVICE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/clients", title: "Clients", desc: "Fitxes, professional assignat/da i bons." },
  { href: "/admin/entrenadors", title: "Professionals", desc: "Equip, especialitat i clients assignats." },
  { href: "/admin/bonos", title: "Bons", desc: "Paquets de sessions i el seu estat." },
  { href: "/admin/reservas", title: "Reserves", desc: "Agenda de sessions." },
  { href: "/admin/prova", title: "Sessions de prova", desc: "Sol·licituds de prova gratuïta i conversió." },
  { href: "/admin/pagos", title: "Pagaments", desc: "Cobraments amb targeta i efectiu." },
  { href: "/admin/serveis", title: "Serveis", desc: "Catàleg de serveis i preus." },
  { href: "/admin/exercicis", title: "Exercicis", desc: "Biblioteca d'exercicis amb vídeo." },
  { href: "/admin/community", title: "Comunitat", desc: "Anuncis i novetats del centre." },
];

const pct1 = (n: number) =>
  n.toLocaleString("ca-ES", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/** Targeta KPI. `tone` "warn" per a les que demanen acció de l'admin. */
function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  children,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "neutral" | "warn";
  href?: string;
  children?: React.ReactNode;
}) {
  const warn = tone === "warn";
  const body = (
    <div
      className={`flex h-full flex-col rounded-2xl border p-4 transition-colors ${
        warn
          ? "border-brand-orange/40 bg-brand-orange/5 hover:border-brand-orange"
          : "border-brand-border bg-white hover:border-brand-purple"
      }`}
    >
      <div
        className={`text-xs font-bold tracking-wide uppercase ${
          warn ? "text-brand-orange" : "text-brand-muted"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          warn ? "text-brand-orange" : "text-brand-purple"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-brand-muted">{hint}</div>}
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminHome() {
  const [viewer, d] = await Promise.all([getViewer(), getAdminDashboard()]);

  const { revenue, pendingBonos, lowBonos, sessions, occupancy, trialConversion } = d;

  const revenueHint =
    revenue.changePct === null ? (
      <span>Sense ingressos el {revenue.previousMonthLabel}</span>
    ) : (
      <span className={revenue.changePct >= 0 ? "text-success" : "text-error"}>
        {revenue.changePct >= 0 ? "↑" : "↓"}
        {pct1(Math.abs(revenue.changePct))}% vs {revenue.previousMonthLabel}
      </span>
    );

  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="text-sm text-brand-muted">{formatLongDate(new Date())}</p>
      <h1 className="mt-0.5 text-2xl text-brand-dark">
        Hola, {viewer?.fullName?.split(" ")[0] ?? "admin"}
      </h1>
      <p className="mt-2 text-sm text-brand-muted">Resum del centre.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Kpi
          label="Ingressos del mes"
          value={formatEur(revenue.current)}
          hint={revenueHint}
          href="/admin/pagos"
        />

        <Kpi
          label="Pendent de cobrament"
          value={formatEur(pendingBonos.total)}
          tone="warn"
          hint={
            pendingBonos.count === 1
              ? "1 bo per cobrar al centre"
              : `${pendingBonos.count} bons per cobrar al centre`
          }
          href="/admin/bonos"
        />

        <Kpi
          label="Sessions"
          value={String(sessions.today)}
          hint={`avui · ${sessions.week} aquesta setmana`}
          href="/admin/reservas"
        />

        <Kpi
          label="Ocupació setmanal"
          value={occupancy.slots > 0 ? `${pct1(occupancy.pct)}%` : "—"}
          hint={
            occupancy.slots > 0
              ? `${occupancy.booked} de ${occupancy.slots} franges`
              : "Sense franges definides"
          }
        >
          {occupancy.perTrainer.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {occupancy.perTrainer.map((t) => (
                <li key={t.trainerId}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-brand-charcoal">
                      {t.trainerName.split(" ")[0]}
                    </span>
                    <span className="shrink-0 font-bold text-brand-muted">
                      {pct1(t.pct)}%
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-brand-bg">
                    <div
                      className="h-full rounded-full bg-brand-purple"
                      style={{ width: `${Math.min(100, t.pct)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Kpi>

        <Kpi
          label="Conversió de proves"
          value={
            trialConversion.pct === null ? "—" : `${pct1(trialConversion.pct)}%`
          }
          hint={
            trialConversion.total === 0
              ? "Encara no hi ha proves fetes"
              : `${trialConversion.converted} de ${trialConversion.total} proves`
          }
          href="/admin/prova"
        />

        {/* Ocupa la cel·la restant del grid; la llista pot créixer. */}
        <div
          className={`col-span-2 flex h-full flex-col rounded-2xl border p-4 lg:col-span-1 ${
            lowBonos.length > 0
              ? "border-brand-orange/40 bg-brand-orange/5"
              : "border-brand-border bg-white"
          }`}
        >
          <div
            className={`text-xs font-bold tracking-wide uppercase ${
              lowBonos.length > 0 ? "text-brand-orange" : "text-brand-muted"
            }`}
          >
            Bons a punt d&apos;esgotar-se
          </div>
          <div
            className={`mt-1 text-2xl font-bold ${
              lowBonos.length > 0 ? "text-brand-orange" : "text-brand-purple"
            }`}
          >
            {lowBonos.length}
          </div>
          {lowBonos.length === 0 ? (
            <p className="mt-1 text-xs text-brand-muted">
              Cap bo per sota del llindar configurat.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-brand-orange/20">
              {lowBonos.map((b) => (
                <li key={b.bonoId}>
                  <Link
                    href={`/admin/clients/${b.clientId}`}
                    className="flex items-baseline justify-between gap-2 py-1.5 text-xs hover:underline"
                  >
                    <span className="truncate">
                      <span className="font-bold text-brand-dark">
                        {b.clientName}
                      </span>{" "}
                      <span className="text-brand-muted">
                        {SERVICE_LABELS[b.serviceType]}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold text-brand-orange">
                      {b.remaining === 1 ? "1 sessió" : `${b.remaining} sessions`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Seccions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.title} href={s.href}>
            <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-white p-5 transition-colors hover:border-brand-purple">
              <h2 className="text-lg text-brand-dark">{s.title}</h2>
              <p className="mt-1 text-sm text-brand-muted">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
