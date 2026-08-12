"use client";

import { useMemo } from "react";
import { formatEur, SERVICE_LABELS } from "@/lib/labels";
import { colorOfService, type ColorPalette } from "@/lib/colors";
import { PriceDisplay } from "@/components/ui/price-display";
import type { Service } from "@/lib/data/services";
import type { EffectivePrice } from "@/lib/data/promotions";
import type { ServiceType } from "@/types/database";

/**
 * Els dos passos de "tria un paquet": primer el tipus de servei, després el
 * paquet concret.
 *
 * Viuen aquí i no dins del formulari de compra de bons perquè els vals de
 * regal fan exactament la mateixa tria. Duplicar-los hauria volgut dir que
 * afegir un servei nou o canviar-ne la icona s'hagués de fer a dos llocs, i
 * tard o d'hora un dels dos s'hauria quedat enrere.
 */

// ─── Icones SVG inline per tipus de servei ───────────────────────────────────
function IconIndividual({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
      <circle cx="12" cy="8" r="4" fill={color} />
      <path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconParelles({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
      <circle cx="8.5" cy="8" r="3.5" fill={color} />
      <circle cx="15.5" cy="8" r="3.5" fill={color} fillOpacity="0.6" />
      <path
        d="M1 20c0-3.3 3.1-6 7.5-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M23 20c0-3.3-3.1-6-7.5-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
      <path
        d="M8.5 14c1.2-.4 2.5-.4 3.5 0 1 .4 2 1 3 2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGrup({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
      <circle cx="5" cy="8" r="2.5" fill={color} fillOpacity="0.5" />
      <circle cx="12" cy="7" r="3" fill={color} />
      <circle cx="19" cy="8" r="2.5" fill={color} fillOpacity="0.5" />
      <path
        d="M1 20c0-2.8 1.8-5 4-5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <path
        d="M23 20c0-2.8-1.8-5-4-5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <path
        d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFisio({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
      <path
        d="M12 3C9 3 7 5 7 8c0 2 1 3.5 2.5 4.5L8 21h8l-1.5-8.5C16 11.5 17 10 17 8c0-3-2-5-5-5z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 10.5c.8.5 1.6.8 2.5.8s1.7-.3 2.5-.8"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const SERVICE_ICONS: Record<ServiceType, (color: string) => React.ReactNode> = {
  ep_individual: (c) => <IconIndividual color={c} />,
  ep_parejas: (c) => <IconParelles color={c} />,
  grupo_reducido: (c) => <IconGrup color={c} />,
  fisioterapia: (c) => <IconFisio color={c} />,
};

// ─── Pas 1: tria el tipus de servei ──────────────────────────────────────────
export function ServiceTypeStep({
  services,
  effectivePrices,
  onSelect,
  palette,
  intro = "Tria el tipus de servei per al qual vols comprar un bo.",
}: {
  services: Service[];
  effectivePrices: Record<string, EffectivePrice>;
  onSelect: (type: ServiceType) => void;
  palette: ColorPalette;
  /** El text de sobre canvia segons per a què es tria (un bo, un regal…). */
  intro?: string;
}) {
  // Agrupa per serviceType i calcula preu mínim efectiu
  const groups = useMemo(() => {
    const map = new Map<ServiceType, Service[]>();
    for (const s of services) {
      const arr = map.get(s.serviceType) ?? [];
      arr.push(s);
      map.set(s.serviceType, arr);
    }
    return Array.from(map.entries()).map(([type, pkgs]) => ({
      type,
      minPrice: Math.min(...pkgs.map((p) => effectivePrices[p.id]?.finalPrice ?? p.price)),
      hasDiscount: pkgs.some((p) => effectivePrices[p.id]?.hasDiscount),
    }));
  }, [services, effectivePrices]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-muted">{intro}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map(({ type, minPrice, hasDiscount }) => {
          const color = colorOfService(palette, type);
          const bgColor = `${color}18`;
          const borderColor = `${color}40`;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className="group flex items-center gap-4 rounded-xl border-2 bg-white p-5 text-left transition-all hover:shadow-md"
              style={{
                borderColor,
                backgroundColor: bgColor,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  color;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  `${color}22`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  borderColor;
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  bgColor;
              }}
            >
              <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}20` }}
              >
                {SERVICE_ICONS[type]?.(color)}
              </div>
              <div className="min-w-0">
                <p
                  className="font-bold leading-tight"
                  style={{ color }}
                >
                  {SERVICE_LABELS[type]}
                </p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  Des de{" "}
                  <span className={hasDiscount ? "font-bold text-brand-orange" : ""}>
                    {formatEur(minPrice)}
                  </span>
                </p>
              </div>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="ml-auto h-5 w-5 flex-shrink-0 text-brand-muted/50"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pas 2: tria el paquet ───────────────────────────────────────────────────
export function PackageStep({
  services,
  serviceType,
  selectedId,
  effectivePrices,
  onSelect,
  onBack,
  palette,
}: {
  services: Service[];
  palette: ColorPalette;
  serviceType: ServiceType;
  selectedId: string;
  effectivePrices: Record<string, EffectivePrice>;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const pkgs = useMemo(
    () => services.filter((s) => s.serviceType === serviceType),
    [services, serviceType],
  );

  // Millor preu per sessió calculat sobre el preu final efectiu
  const bestId = useMemo(() => {
    if (pkgs.length <= 1) return null;
    return pkgs.reduce((best, s) => {
      const ep = effectivePrices[s.id];
      const bestEp = effectivePrices[best.id];
      const perSession = (ep?.finalPrice ?? s.price) / s.defaultSessions;
      const bestPerSession = (bestEp?.finalPrice ?? best.price) / best.defaultSessions;
      return perSession < bestPerSession ? s : best;
    }).id;
  }, [pkgs, effectivePrices]);

  const color = colorOfService(palette, serviceType);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-brand-muted transition-colors hover:text-brand-dark"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clipRule="evenodd"
          />
        </svg>
        Canviar servei
      </button>

      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          {SERVICE_ICONS[serviceType]?.(color)}
        </div>
        <h2 className="font-bold" style={{ color }}>
          {SERVICE_LABELS[serviceType]}
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {pkgs.map((pkg) => {
          const ep = effectivePrices[pkg.id] ?? {
            originalPrice: pkg.price,
            finalPrice: pkg.price,
            discountAmount: 0,
            discountLabel: "",
            hasDiscount: false,
          };
          const isBest = pkg.id === bestId;
          const isSelected = pkg.id === selectedId;

          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => onSelect(pkg.id)}
              className="relative flex items-center gap-4 rounded-xl border-2 bg-white p-4 text-left transition-all hover:shadow-sm"
              style={{
                borderColor: isSelected ? color : "#e5e7eb",
                backgroundColor: isSelected ? `${color}08` : "white",
              }}
            >
              {isBest && (
                <span
                  className="absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase"
                  style={{ backgroundColor: color }}
                >
                  Millor preu
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="font-bold text-brand-dark">{pkg.name}</p>
                <p className="mt-0.5 text-xs text-brand-muted">
                  {pkg.defaultSessions} session
                  {pkg.defaultSessions !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                <PriceDisplay
                  ep={ep}
                  showPerSession={pkg.defaultSessions > 1 ? pkg.defaultSessions : undefined}
                />
              </div>

              <div
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                style={{
                  borderColor: isSelected ? color : "#d1d5db",
                  backgroundColor: isSelected ? color : "transparent",
                }}
              >
                {isSelected && (
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    className="h-3 w-3"
                  >
                    <path
                      d="M2.5 6l2.5 2.5 4.5-5"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

