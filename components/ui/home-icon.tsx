/**
 * Les icones de les pantalles d'inici.
 *
 * Vivien dins de l'inici del client, que va ser el primer que es va
 * redissenyar. En arribar el de l'admin calia el mateix joc: o es duplicaven
 * vuit SVG o sortien d'aquí. Són dades de dibuix, no components de negoci, i
 * per això van a `ui/`.
 */

const ICONS = {
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z" />
      <path d="M14 6v12" strokeDasharray="2 3" />
    </>
  ),
  calendarPlus: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4" />
    </>
  ),
  chart: (
    <>
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M3 9v6M7 6v12M17 6v12M21 9v6M7 12h10" />
    </>
  ),
  euro: (
    <>
      <path d="M17 6a6 6 0 100 12M4 10h8M4 14h8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 13h18M12 9v12" />
      <path d="M12 9S10.5 3 7.5 3a2.5 2.5 0 000 5H12zM12 9s1.5-6 4.5-6a2.5 2.5 0 010 5H12z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

/** Quadrat lila amb la icona, el mateix a tota la pantalla. */
export function IconBox({ name }: { name: IconName }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple">
      <Icon name={name} />
    </span>
  );
}

