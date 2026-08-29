"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/lib/actions/locale-actions";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";

/**
 * Tria d'idioma.
 *
 * Cada idioma surt escrit EN el seu idioma ("English", no "Anglès"): qui entra
 * i no entén el que hi ha a la pantalla ha de poder reconèixer el seu sense
 * saber llegir la resta.
 *
 * Després de desar-lo es fa un `refresh()`: el text el pinta el servidor, i
 * sense tornar a demanar-li la pàgina seguiria en l'idioma anterior.
 */
export function LanguageSwitcher({
  current,
  label,
  className,
}: {
  current: Locale;
  /** Etiqueta visible. Si no n'hi ha, el select va sol amb aria-label. */
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(value: string) {
    startTransition(async () => {
      await setLocaleAction(value);
      router.refresh();
    });
  }

  /**
   * `useId` i no un comptador propi.
   *
   * Amb un comptador de mòdul, el servidor i el navegador no compten igual i
   * l'id sortia diferent a cada banda ("lang-1" contra "lang-2"). React ho
   * detecta com una discrepància d'hidratació, abandona aquest subarbre i el
   * deixa SENSE els seus gestors: el desplegable es pintava bé i no feia
   * absolutament res en canviar-lo. `useId` dona el mateix id als dos costats.
   */
  const id = useId();

  const select = (
    <select
      id={id}
      value={current}
      disabled={pending}
      onChange={(e) => change(e.target.value)}
      aria-label={label ?? "Language"}
      className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 disabled:opacity-60"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_NAMES[l]}
        </option>
      ))}
    </select>
  );

  if (!label) return <div className={className}>{select}</div>;

  return (
    <div className={`flex flex-col gap-1.5 text-sm ${className ?? ""}`}>
      <label
        htmlFor={id}
        className="font-bold tracking-wide text-brand-charcoal uppercase"
      >
        {label}
      </label>
      {select}
    </div>
  );
}
