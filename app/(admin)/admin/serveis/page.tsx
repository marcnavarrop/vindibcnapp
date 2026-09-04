import Link from "next/link";
import { TAP } from "@/lib/utils";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/serveis", label: "Serveis" },
  { href: "/admin/ofertes", label: "Ofertes" },
  { href: "/admin/etiquetes", label: "Etiquetes" },
];
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/ui/price-display";
import { listServices, type Service } from "@/lib/data/services";
import { getEffectivePrices } from "@/lib/data/promotions";
import { toggleServiceAction } from "@/app/(admin)/admin/serveis/actions";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

export const dynamic = "force-dynamic";


export default async function ServeisPage() {
  const services = await listServices();
  // Sense clientId a posta: aquest és el catàleg del centre, no el preu d'algú.
  // Les ofertes segmentades no hi surten —una oferta per als VIP no és el preu
  // del paquet—. Qui les vulgui veure les té a /admin/ofertes, amb el seu públic.
  const effectivePrices = await getEffectivePrices(services);

  const byType = new Map<ServiceType, Service[]>();
  for (const s of services) {
    const list = byType.get(s.serviceType) ?? [];
    list.push(s);
    byType.set(s.serviceType, list);
  }
  const types = [
    ...SERVICE_TYPES.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !SERVICE_TYPES.includes(t)),
  ];

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl text-brand-dark">Serveis i paquets</h1>
        <Link
          href="/admin/serveis/new"
          className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
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
                          className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
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
                            className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-dark ${TAP}`}
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
