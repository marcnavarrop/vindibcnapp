import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getPreState, DEMO_ACCOUNTS } from "@/lib/pre-mode";
import {
  switchToDemoAction,
  returnToAdminAction,
} from "@/lib/actions/pre-mode";
import { TAP } from "@/lib/utils";

/**
 * El distintiu del mode PRE.
 *
 * ES VEU EN ELS DOS ESTATS, I NO ÉS EL MATEIX AVÍS DUES VEGADES
 *
 * Són dos riscos diferents:
 *  - Armat i encara ets tu: el que cal recordar és que tens un canvi
 *    d'identitat a un clic. Avís discret.
 *  - Saltat a un demo: el que cal recordar és que això és la base de dades de
 *    PRODUCCIÓ i que el que veus són dades d'un compte de proves. Avís rotund,
 *    perquè aquí confondre's té conseqüències.
 *
 * El color és el `brand-orange` de `legal-draft-banner.tsx`: en aquesta casa ja
 * vol dir "atenció, això és provisional". No se n'estrena cap.
 *
 * EL SELECTOR VIU AQUÍ DINS a posta: quan estàs fent de Client Demo, el menú
 * lateral és el del client i no hi ha cap altre lloc on posar-lo.
 *
 * Són formularis i prou, sense JS de client: la pinta un Server Component i les
 * accions són Server Actions. Un botó que canvia de sessió no necessita estat
 * al navegador.
 */
export async function PreModeBanner() {
  const viewer = await getViewer();
  const state = await getPreState(viewer?.id);
  if (state.mode === "off") return null;

  const acting = state.mode === "acting";
  const current = acting ? state.demo : null;
  const others = DEMO_ACCOUNTS.filter((d) => d.slug !== current?.slug);

  return (
    <div
      role="note"
      className={[
        // Enganxat a dalt en escriptori, que és on es prova. En mòbil es queda
        // al seu lloc: la barra lila del menú ja ocupa el `top-0` d'allà i
        // dues coses enganxades al mateix lloc es tapen.
        "z-20 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm lg:sticky lg:top-0",
        "print:hidden",
        acting
          ? "bg-brand-orange text-white"
          : "border-b-2 border-brand-orange bg-brand-orange/10 text-brand-dark",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
            acting ? "bg-white/20 text-white" : "bg-brand-orange text-white",
          ].join(" ")}
        >
          Mode PRE
        </span>
        {acting ? (
          <span>
            Estàs veient l&apos;app com a{" "}
            <strong className="font-bold">{current!.label}</strong>. Les dades
            són de producció.
          </span>
        ) : (
          <span>
            Ets <strong className="font-bold">{state.adminName}</strong>. Salta
            a un compte de demostració per provar-ho.
          </span>
        )}
      </span>

      <span className="ml-auto flex flex-wrap items-center gap-2">
        {others.map((demo) => (
          <form key={demo.slug} action={switchToDemoAction}>
            <input type="hidden" name="slug" value={demo.slug} />
            <button
              type="submit"
              className={[
                "rounded-lg border px-2.5 py-1.5 text-xs font-bold tracking-wide uppercase",
                TAP,
                acting
                  ? "border-white/40 text-white hover:bg-white/15 active:bg-white/25"
                  : "border-brand-orange bg-white text-brand-orange hover:bg-brand-orange/10 active:bg-brand-orange/20",
              ].join(" ")}
            >
              {demo.label}
            </button>
          </form>
        ))}

        {acting ? (
          <form action={returnToAdminAction}>
            <button
              type="submit"
              className={`rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold tracking-wide text-brand-orange uppercase hover:bg-white/90 active:bg-white/80 ${TAP}`}
            >
              ← Tornar a {state.adminName}
            </button>
          </form>
        ) : (
          <Link
            href="/admin/configuracio"
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold tracking-wide text-brand-orange uppercase underline hover:text-brand-dark ${TAP}`}
          >
            Apagar
          </Link>
        )}
      </span>
    </div>
  );
}
