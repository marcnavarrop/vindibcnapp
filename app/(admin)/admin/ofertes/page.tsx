import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listPromotions } from "@/lib/data/promotions";
import { listActiveServices } from "@/lib/data/services";
import { SERVICE_LABELS, formatEur } from "@/lib/labels";
import {
  toggleOfertaAction,
  deleteOfertaAction,
} from "@/app/(admin)/admin/ofertes/actions";

export const dynamic = "force-dynamic";

function promotionStatus(p: {
  active: boolean;
  startsAt: string;
  endsAt: string;
}): { label: string; tone: "success" | "warn" | "neutral" | "danger" } {
  const today = new Date().toISOString().slice(0, 10);
  if (!p.active) return { label: "Desactivada", tone: "neutral" };
  if (p.startsAt > today) return { label: "Futura", tone: "warn" };
  if (p.endsAt < today) return { label: "Caducada", tone: "neutral" };
  return { label: "Activa", tone: "success" };
}

export default async function OfertesPage({
  searchParams,
}: {
  searchParams: Promise<{ overlap?: string }>;
}) {
  const sp = await searchParams;
  const [promotions, services] = await Promise.all([
    listPromotions(),
    listActiveServices(),
  ]);

  const serviceMap = new Map(services.map((s) => [s.id, s]));

  function scopeLabel(p: (typeof promotions)[0]) {
    if (p.scope === "service" && p.serviceType)
      return `Tot ${SERVICE_LABELS[p.serviceType]}`;
    if (p.scope === "package" && p.serviceId) {
      const s = serviceMap.get(p.serviceId);
      return s
        ? `${SERVICE_LABELS[s.serviceType]} · ${s.name}`
        : `Paquet (${p.serviceId.slice(0, 8)}…)`;
    }
    return "—";
  }

  function discountLabel(p: (typeof promotions)[0]) {
    return p.discountType === "percentage"
      ? `-${p.discountValue}%`
      : `-${formatEur(p.discountValue)}`;
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl text-brand-dark">Ofertes i descomptes</h1>
        <Link
          href="/admin/ofertes/new"
          className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
        >
          + Nova oferta
        </Link>
      </div>

      {sp.overlap === "1" && (
        <div className="mb-4 rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange">
          Ja hi havia una altra oferta activa que es solapava. S&apos;ha creat
          igualment — revisa que no sigui un error.
        </div>
      )}

      {promotions.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no hi ha cap oferta. Crea&apos;n una amb el botó de dalt.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-border bg-white">
          <div className="divide-y divide-brand-border">
            {promotions.map((p) => {
              const status = promotionStatus({
                active: p.active,
                startsAt: p.startsAt,
                endsAt: p.endsAt,
              });
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-sm"
                >
                  <div className="min-w-[10rem] flex-1">
                    <p className="font-bold text-brand-dark">{p.name}</p>
                    <p className="text-xs text-brand-muted">{scopeLabel(p)}</p>
                  </div>
                  <span className="font-bold text-brand-orange">
                    {discountLabel(p)}
                  </span>
                  <span className="text-brand-muted">
                    {p.startsAt} → {p.endsAt}
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <div className="ml-auto flex items-center gap-3">
                    <Link
                      href={`/admin/ofertes/${p.id}/edit`}
                      className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                    >
                      Editar
                    </Link>
                    <form action={toggleOfertaAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={String(!p.active)}
                      />
                      <button
                        type="submit"
                        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-dark"
                      >
                        {p.active ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                    <form
                      action={deleteOfertaAction}
                      onSubmit={(e) => {
                        if (
                          !confirm(
                            "Segur que vols eliminar aquesta oferta? Aquesta acció no es pot desfer.",
                          )
                        )
                          e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs font-bold tracking-wide text-error uppercase hover:opacity-70"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
