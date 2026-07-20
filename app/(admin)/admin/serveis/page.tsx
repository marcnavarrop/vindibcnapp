import Link from "next/link";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/serveis", label: "Serveis" },
  { href: "/admin/ofertes", label: "Ofertes" },
];
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/ui/price-display";
import { listServices, type Service } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { toggleServiceAction } from "@/app/(admin)/admin/serveis/actions";
import { SERVICE_LABELS } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

export const dynamic = "force-dynamic";

const SERVICE_ORDER: ServiceType[] = [
  "ep_individual",
  "ep_parejas",
  "grupo_reducido",
  "fisioterapia",
];

export default async function ServeisPage() {
  const services = await listServices();
  const effectivePrices = await getEffectivePrices(services);

  const byType = new Map<ServiceType, Service[]>();
  for (const s of services) {
    const list = byType.get(s.serviceType) ?? [];
    list.push(s);
    byType.set(s.serviceType, list);
  }
  const types = [
    ...SERVICE_ORDER.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !SERVICE_ORDER.includes(t)),
  ];

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl text-brand-dark">Serveis i paquets</h1>
        <Link
          href="/admin/serveis/new"
          className="inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-brand-purple-light"
        >
          + Nou paquet
        </Link>
      </div>

      {types.length === 0 ? (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no hi ha cap paquet al catàleg.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {types.map((type) => (
            <section
              key={type}
              className="overflow-hidden rounded-2xl border border-brand-border bg-white"
            >
              <h2 className="border-b border-brand-border bg-brand-bg px-5 py-3 text-sm font-bold tracking-wide text-brand-dark uppercase">
                {SERVICE_LABELS[type]}
              </h2>
              <div className="divide-y divide-brand-border">
                {byType.get(type)!.map((s) => {
                  const ep = effectivePrices.get(s.id)!;
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm"
                    >
                      <span className="min-w-[8rem] font-bold text-brand-dark">
                        {s.name}
                      </span>
                      <span className="text-brand-muted">
                        {s.defaultSessions}{" "}
                        {s.defaultSessions === 1 ? "sessió" : "sessions"}
                      </span>
                      <PriceDisplay ep={ep} size="sm" />
                      <Badge tone={s.active ? "success" : "neutral"}>
                        {s.active ? "Actiu" : "Inactiu"}
                      </Badge>
                      <div className="ml-auto flex items-center gap-3">
                        <Link
                          href={`/admin/serveis/${s.id}/edit`}
                          className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                        >
                          Editar
                        </Link>
                        <form action={toggleServiceAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={String(!s.active)}
                          />
                          <button
                            type="submit"
                            className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-dark"
                          >
                            {s.active ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
    </>
  );
}
