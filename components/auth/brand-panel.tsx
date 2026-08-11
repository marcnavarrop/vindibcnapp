/* eslint-disable @next/next/no-img-element */
import { Wordmark } from "@/components/wordmark";

/**
 * Panell de marca de la pantalla d'entrada.
 *
 * És la meitat esquerra: logo, titular, il·lustració i les tres coses que el
 * client pot fer. Viu en un component propi perquè la pàgina d'entrada ja té
 * prou feina amb el formulari, i perquè si algun dia el registre estrena la
 * mateixa composició, el panell ja és aquí.
 *
 * S'usa <img> i no next/image a propòsit: són dos fitxers locals que es pinten
 * a mida coneguda, i next/image només hi afegiria configuració per no guanyar
 * res mesurable.
 */

const FEATURES = [
  {
    title: "Reserves en 1 clic",
    desc: "Reserva o anul·la en segons.",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4" />
      </>
    ),
  },
  {
    title: "Seguiment de bons",
    desc: "Sessions i bons, sempre al dia.",
    icon: (
      <>
        <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z" />
        <path d="M14 6v12" strokeDasharray="2 3" />
      </>
    ),
  },
  {
    title: "Comunitat i avisos",
    desc: "Novetats i avisos del centre.",
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
    <div className="relative flex flex-col gap-4 overflow-hidden bg-brand-purple px-6 py-7 text-white sm:gap-4 sm:p-8 lg:p-10">
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

      <div className="relative flex flex-col gap-3">
        {/* Logotip oficial. Abans eren l'isotip i el text "indi" muntats a mà;
            ara és el mateix fitxer que la resta de l'app. */}
        <Wordmark height={48} />

        <span className="w-fit rounded-full border border-white/25 px-3 py-1 text-[11px] font-bold tracking-[0.14em] text-white/80 uppercase">
          Àrea client
        </span>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl leading-tight font-bold text-balance sm:text-[1.75rem]">
            El teu centre, al teu abast
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-white/70">
            Gestiona les teves reserves, consulta les sessions i els teus plans
            actius, tot en un sol lloc.
          </p>
        </div>
      </div>

      {/* Il·lustració.
          `flex-1 min-h-0` + `object-contain`: agafa tot l'espai que sobra i
          s'encongeix quan la finestra és baixa, en comptes de fer créixer el
          panell i obligar a fer scroll. Mai es deforma ni es retalla.

          Els marges negatius la fan sagnar cap als costats: a la referència la
          composició ocupa gairebé tota l'amplada, amb el lotus i el calendari
          als extrems, i centrada amb marge es veia com una miniatura.

          Sense màscara ni mescla: el fitxer ja porta transparència. El PNG
          original venia amb el seu propi fons morat, que no era exactament el
          del panell i deixava un rectangle visible; provar-ho amb màscara
          radial o `mix-blend-screen` només movia el problema de lloc. Els
          traços s'han separat del fons per contrast local, així que ara la
          il·lustració seu sobre el degradat sense cap vora. */}
      <div className="relative -mx-5 hidden min-h-0 flex-1 items-center justify-center sm:-mx-7 sm:flex lg:-mx-9">
        <img
          src="/images/hero-entrenament.webp"
          alt=""
          aria-hidden
          width={1285}
          height={986}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Sempre en fila: icona en un quadrat a l'esquerra i, a la dreta,
          títol i descripció. Apilades (icona a dalt, text a sota) feien la
          fila el doble d'alta i li menjaven l'espai a la il·lustració. */}
      <ul className="relative grid gap-2.5 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.07] p-2.5 backdrop-blur-sm"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
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
