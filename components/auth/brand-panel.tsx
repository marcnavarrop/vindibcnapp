/* eslint-disable @next/next/no-img-element */

/**
 * Panell de marca de la pantalla d'entrada.
 *
 * És la meitat esquerra: logo, titular, il·lustració i les tres coses que el
 * client pot fer. Viu en un component propi perquè la pàgina d'entrada ja té
 * prou feina amb el formulari, i perquè si algun dia el registre estrena la
 * mateixa composició, el panell ja és aquí.
 *
 * S'usa <img> i no next/image per al logo: és un PNG local i petit que es
 * pinta a mida fixa, i next/image només hi afegiria feina.
 */

/** Il·lustració de línia: figura fent una gambada, envoltada del que ofereix el centre. */
function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 420 300"
      fill="none"
      className="h-auto w-full max-w-sm"
      aria-hidden
    >
      <defs>
        <linearGradient id="vindiStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff6d17" />
          <stop offset="100%" stopColor="#c77dff" />
        </linearGradient>
      </defs>

      {/* Cercle de fons */}
      <circle
        cx="210"
        cy="150"
        r="118"
        stroke="#ffffff"
        strokeOpacity="0.14"
        strokeWidth="1"
      />
      <circle
        cx="210"
        cy="150"
        r="140"
        stroke="#ffffff"
        strokeOpacity="0.07"
        strokeWidth="1"
        strokeDasharray="3 7"
      />

      {/* ── Figura fent una gambada, de perfil mirant a la dreta ──
          L'asimetria és el que fa que es llegeixi: cama de davant flexionada
          cap a la dreta, cama del darrere estirada cap enrere. Simètrica es
          veia com un triangle, no com algú entrenant. */}
      <g
        stroke="url(#vindiStroke)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Monyo i cap */}
        <circle cx="198" cy="92" r="12" />
        <circle cx="182" cy="84" r="6.5" />
        {/* Coll */}
        <path d="M199 104l3 11" />
        {/* Tors, lleugerament endavant */}
        <path d="M202 115c1 13-1 26-4 37" />
        {/* Pelvis */}
        <path d="M190 152h16" />
        {/* Cama de davant: cuixa, tíbia i peu */}
        <path d="M204 153c12 7 22 15 25 25" />
        <path d="M229 178c1 11 1 19 0 26" />
        <path d="M224 204h18" />
        {/* Cama del darrere: estirada, genoll baix */}
        <path d="M194 153c-10 10-21 21-28 33" />
        <path d="M166 186c-6 7-11 13-15 17" />
        <path d="M145 203h18" />
        {/* Braços */}
        <path d="M205 119c6 10 8 20 5 31" />
        <path d="M199 119c-6 10-9 20-8 31" />
      </g>

      {/* Terra */}
      <path
        d="M148 206h132"
        stroke="#ffffff"
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />

      {/* ── Icones al voltant ── */}
      <g
        stroke="#c77dff"
        strokeOpacity="0.9"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Flor de lotus */}
        <g transform="translate(70 100)">
          <path d="M15 24c-9-3-14-10-14-17 5-1 11 1 14 6" />
          <path d="M15 24c9-3 14-10 14-17-5-1-11 1-14 6" />
          <path d="M15 24c-5-7-6-15-1-22 6 5 7 15 1 22z" />
        </g>

        {/* Manuella */}
        <g transform="translate(56 172)">
          <rect x="0" y="6" width="6" height="14" rx="2" />
          <rect x="30" y="6" width="6" height="14" rx="2" />
          <path d="M6 13h24" strokeWidth="3" />
        </g>

        {/* Calendari amb marca */}
        <g transform="translate(298 92)">
          <rect x="0" y="5" width="46" height="42" rx="7" />
          <path d="M0 18h46M13 0v9M33 0v9" />
          <path d="M13 32l7 7 13-14" stroke="#ff6d17" strokeWidth="2.4" />
        </g>

        {/* Cor */}
        <g transform="translate(304 176)">
          <path d="M17 32S2 22 2 12A9 9 0 0117 6.5 9 9 0 0132 12c0 10-15 20-15 20z" />
        </g>
      </g>

      {/* Punts d'accent */}
      <circle cx="120" cy="140" r="3.5" fill="#ff6d17" />
      <circle cx="296" cy="150" r="3" fill="#c77dff" />
      <circle cx="252" cy="66" r="2.5" fill="#ff6d17" fillOpacity="0.7" />
    </svg>
  );
}

const FEATURES = [
  {
    title: "Reserves en 1 clic",
    desc: "Reserva, modifica o anul·la en segons.",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4" />
      </>
    ),
  },
  {
    title: "Seguiment de bons",
    desc: "Consulta els teus bons i sessions disponibles.",
    icon: (
      <>
        <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z" />
        <path d="M14 6v12" strokeDasharray="2 3" />
      </>
    ),
  },
  {
    title: "Comunitat i avisos",
    desc: "Rep novetats i avisos del teu centre.",
    icon: (
      <>
        <path d="M18 8A6 6 0 006 8c0 7-3 8-3 8h18s-3-1-3-8z" />
        <path d="M13.7 21a2 2 0 01-3.4 0" />
      </>
    ),
  },
];

export function BrandPanel() {
  return (
    <div className="relative flex flex-col justify-between gap-6 overflow-hidden bg-brand-purple px-6 py-8 text-white sm:gap-8 sm:p-10 lg:p-12">
      {/* Degradat i lluïssors de marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,#3d0f3c_0%,#642263_45%,#4a1749_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,var(--color-brand-orange)_0%,transparent_65%)] opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,#c77dff_0%,transparent_70%)] opacity-30"
      />

      <div className="relative flex flex-col gap-6">
        {/* Logo: la "v" és l'isotip real; la resta, el nom en taronja. */}
        <div className="flex items-center gap-0.5">
          <img
            src="/logo_vindi.png"
            alt="VindiBCN"
            width={52}
            height={52}
            className="h-11 w-11 object-contain sm:h-13 sm:w-13"
          />
          <span className="font-display text-4xl leading-none font-bold tracking-tight text-brand-orange sm:text-5xl">
            indi
          </span>
        </div>

        <span className="w-fit rounded-full border border-white/25 px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-white/80 uppercase">
          Àrea client
        </span>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl leading-tight font-bold text-balance sm:text-3xl">
            El teu centre, al teu abast
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-white/70">
            Gestiona les teves reserves, consulta les sessions i els teus plans
            actius, tot en un sol lloc.
          </p>
        </div>
      </div>

      {/* La il·lustració és decoració: en pantalles baixes desapareix abans que
          res del que informa. */}
      <div className="relative hidden justify-center py-2 sm:flex">
        <HeroIllustration />
      </div>

      {/* En mòbil, en fila (icona a l'esquerra) per no menjar-se la pantalla
          abans d'arribar al formulari, que és a què ve la gent. A partir de
          `sm` recuperen la graella de tres columnes del disseny. */}
      <ul className="relative grid gap-2.5 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur-sm sm:block sm:p-3.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white sm:mb-2">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {f.icon}
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-xs leading-tight font-bold text-balance text-white">
                {f.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-white/60">
                {f.desc}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
