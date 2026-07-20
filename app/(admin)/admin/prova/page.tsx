import Link from "next/link";
import { listTrialBookings } from "@/lib/data/trial-bookings";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/reservas", label: "Reserves" },
  { href: "/admin/prova", label: "Sessions de prova" },
  { href: "/admin/disponibilitat", label: "Disponibilitat" },
];
import { SERVICE_LABELS } from "@/lib/labels";
import {
  acceptTrialAdminAction,
  rejectTrialAdminAction,
  setTrialStatusAdminAction,
} from "@/app/(admin)/admin/prova/actions";
import type { TrialStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<TrialStatus, string> = {
  pending: "Pendent",
  confirmed: "Confirmada",
  rejected: "Rebutjada",
  expired: "Caducada",
  completed: "Completada",
  no_show: "No presentat",
  cancelled: "Cancel·lada",
};

const STATUS_STYLE: Record<TrialStatus, string> = {
  pending: "bg-brand-orange/15 text-brand-orange",
  confirmed: "bg-brand-purple/15 text-brand-purple",
  rejected: "bg-error/10 text-error",
  expired: "bg-brand-border/60 text-brand-muted",
  completed: "bg-success/10 text-success",
  no_show: "bg-error/10 text-error",
  cancelled: "bg-brand-border/60 text-brand-muted",
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function AdminProvaPage() {
  const trials = await listTrialBookings();
  const pending = trials.filter((t) => t.status === "pending");
  const rest = trials.filter((t) => t.status !== "pending");

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
      <Link
        href="/admin"
        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
      >
        ← Tornar
      </Link>
      <h1 className="mt-1 mb-1 text-2xl text-brand-dark">Sessions de prova</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Sol·licituds de sessió de prova gratuïta. Les pendents pre-bloquegen el
        forat fins que es confirmen, es rebutgen o caduquen.
      </p>

      {trials.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no hi ha cap sol·licitud de prova.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {pending.length > 0 && (
            <Section title={`Pendents (${pending.length})`}>
              {pending.map((t) => (
                <TrialRow key={t.id} t={t} />
              ))}
            </Section>
          )}
          <Section title="Històric">
            {rest.length === 0 ? (
              <p className="px-5 py-4 text-sm text-brand-muted">
                Res a l&apos;històric.
              </p>
            ) : (
              rest.map((t) => <TrialRow key={t.id} t={t} />)
            )}
          </Section>
        </div>
      )}
    </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
      <h2 className="border-b border-brand-border bg-brand-bg px-5 py-2.5 text-sm font-bold tracking-wide text-brand-dark uppercase">
        {title}
      </h2>
      <div className="divide-y divide-brand-border">{children}</div>
    </section>
  );
}

function TrialRow({
  t,
}: {
  t: Awaited<ReturnType<typeof listTrialBookings>>[number];
}) {
  const canAct = t.status === "pending" || t.status === "confirmed";
  const canConvert = t.status !== "rejected" && !t.convertedClientId;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
      <div className="min-w-[10rem] flex-1">
        <div className="font-bold text-brand-dark">{t.fullName}</div>
        <div className="text-xs text-brand-muted">
          <a href={`tel:${t.phone}`} className="hover:text-brand-purple">
            {t.phone}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${t.email}`} className="hover:text-brand-purple">
            {t.email}
          </a>
        </div>
      </div>
      <div className="text-brand-muted">
        {fmt(t.scheduledAt)}
        <span className="block text-xs">
          {t.trainerName ?? "—"} · {SERVICE_LABELS[t.serviceType]}
        </span>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[t.status]}`}
      >
        {STATUS_LABELS[t.status]}
        {t.convertedClientId && " · client"}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {t.status === "pending" && (
          <form action={acceptTrialAdminAction}>
            <input type="hidden" name="id" value={t.id} />
            <button
              type="submit"
              className="rounded-md bg-brand-purple px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-purple-light"
            >
              Acceptar
            </button>
          </form>
        )}
        {canAct && (
          <form action={rejectTrialAdminAction}>
            <input type="hidden" name="id" value={t.id} />
            <button
              type="submit"
              className="rounded-md border border-brand-border px-2.5 py-1.5 text-xs font-bold text-error hover:bg-error/10"
            >
              Rebutjar
            </button>
          </form>
        )}
        {t.status === "confirmed" && (
          <>
            <StatusButton id={t.id} status="completed" label="Completada" />
            <StatusButton id={t.id} status="no_show" label="No presentat" />
            <StatusButton id={t.id} status="cancelled" label="Cancel·lar" />
          </>
        )}
        {canConvert && (
          <Link
            href={`/admin/clients/new?trial=${t.id}`}
            className="rounded-md bg-brand-orange px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90"
          >
            Convertir en client
          </Link>
        )}
      </div>
    </div>
  );
}

function StatusButton({
  id,
  status,
  label,
}: {
  id: string;
  status: TrialStatus;
  label: string;
}) {
  return (
    <form action={setTrialStatusAdminAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="rounded-md border border-brand-border px-2.5 py-1.5 text-xs font-bold text-brand-muted hover:text-brand-dark"
      >
        {label}
      </button>
    </form>
  );
}
