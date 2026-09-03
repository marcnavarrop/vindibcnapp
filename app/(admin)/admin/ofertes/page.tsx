import Link from "next/link";
import { TAP } from "@/lib/utils";
import { GroupTabs } from "@/components/ui/group-tabs";
import { centerToday } from "@/lib/center-time";

const TABS = [
  { href: "/admin/serveis", label: "Serveis" },
  { href: "/admin/ofertes", label: "Ofertes" },
  { href: "/admin/etiquetes", label: "Etiquetes" },
];
import { Badge } from "@/components/ui/badge";
import { listPromotions, formatDiscountLabel } from "@/lib/data/promotions";
import { listActiveServices } from "@/lib/data/services";
import { listClientTags } from "@/lib/data/client-tags";
import { SERVICE_LABELS } from "@/lib/labels";
import { toggleOfertaAction } from "@/app/(admin)/admin/ofertes/actions";
import { DeleteOfertaButton } from "@/components/forms/delete-oferta-button";

export const dynamic = "force-dynamic";

function promotionStatus(p: {
  active: boolean;
  startsAt: string;
  endsAt: string;
}): { label: string; tone: "success" | "warn" | "neutral" | "danger" } {
  const today = centerToday();
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
  const [promotions, services, tags] = await Promise.all([
    listPromotions(),
    listActiveServices(),
    listClientTags(),
  ]);

  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const tagMap = new Map(tags.map((t) => [t.id, t]));

  function scopeLabel(p: (typeof promotions)[0]) {
    if (p.scope === "service" && p.serviceTypes.length > 0)
      return p.serviceTypes.map((t) => SERVICE_LABELS[t]).join(", ");
    if (p.scope === "package" && p.serviceIds.length > 0) {
      return p.serviceIds
        .map((id) => {
          const s = serviceMap.get(id);
          return s ? `${SERVICE_LABELS[s.serviceType]} · ${s.name}` : id.slice(0, 8) + "…";
        })
        .join(", ");
    }
    return "—";
  }

  /**
   * A qui arriba l'oferta. Va al costat de l'àmbit perquè les dues frases junten
   * la definició sencera: QUÈ rebaixa i A QUI. Sense això caldria obrir cada
   * oferta per saber si és general o segmentada.
   */
  function audienceLabel(p: (typeof promotions)[0]) {
    if (p.audience === "tag") {
      const tag = p.audienceTagId ? tagMap.get(p.audienceTagId) : null;
      // L'etiqueta pot faltar si algú l'ha esborrat per fora (la FK restrict ho
      // impedeix des de l'app, però no des del SQL Editor).
      return `Etiqueta: ${tag?.name ?? "—"}`;
    }
    if (p.audience === "active_bono")
      return `Amb bo actiu de ${
        p.audienceServiceType ? SERVICE_LABELS[p.audienceServiceType] : "—"
      }`;
    return "Tothom";
  }

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl text-brand-dark">Ofertes i descomptes</h1>
        <Link
          href="/admin/ofertes/new"
          className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
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
                    <p className="text-xs text-brand-muted">
                      {p.audience === "all" ? (
                        audienceLabel(p)
                      ) : (
                        <span className="font-bold text-brand-purple">
                          {audienceLabel(p)}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="font-bold text-brand-orange">
                    {formatDiscountLabel(p.discountType, p.discountValue)}
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
                    <DeleteOfertaButton id={p.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
    </>
  );
}
