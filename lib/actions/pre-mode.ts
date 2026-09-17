"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";
import {
  type DemoAccount,
  clearBackTicket,
  clearPreTicket,
  demoById,
  demoBySlug,
  readBackTicket,
  readPreTicket,
  writeBackTicket,
  writePreTicket,
} from "@/lib/pre-mode";

/**
 * Accions del mode PRE. El disseny i el perquè, a lib/pre-mode.ts.
 *
 * Viu a `lib/actions/` i no dins de `app/(admin)/admin/configuracio/` perquè
 * el banner que les crida es pinta a `AppShell`, o sigui també a /trainer i a
 * /client: no són accions d'una pantalla d'admin, són de tota la casa.
 */

const CONFIG = "/admin/configuracio";

/** Codis de fallada. Els llegeix la pestanya "Mode PRE" i els tradueix. */
export type PreError =
  | "off"
  | "slug"
  | "notadmin"
  | "nosession"
  | "link"
  | "mismatch"
  | "verify";

function fail(home: string, code: PreError): never {
  redirect(`${home}?pre=${code}`);
}

/**
 * Resol cap a QUI es salta, i ho torna a comprovar tot després de resoldre.
 *
 * Les tres comprovacions no són la mateixa tres cops:
 *  1. El `slug` ha de ser un dels tres noms curts. El navegador no envia mai ni
 *     un correu ni un id.
 *  2. L'usuari que torna `generateLink` ha de tenir EXACTAMENT l'id i el correu
 *     que diu la constant. Si el correu d'un demo canviés a Supabase, el salt
 *     s'atura en comptes d'anar a parar a un altre compte.
 *  3. El rol que hi ha a `profiles` ha de ser el que diu la constant, i mai
 *     "admin". Aquesta és la que aguanta si algú amplia la llista sense pensar.
 */
async function resolveDemoTarget(
  target: DemoAccount,
): Promise<{ tokenHash: string } | null> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
  });
  if (error || !data?.user || !data.properties?.hashed_token) return null;

  // (2) Identitat exacta.
  if (data.user.id !== target.id) return null;
  if ((data.user.email ?? "").toLowerCase() !== target.email) return null;

  // (3) El rol real, llegit ara, no el que ens agradaria que fos.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", target.id)
    .single();
  const role = profile?.role;
  if (!role) return null;
  // L'ordre importa: primer "mai un admin" contra el rol CRU, i després que
  // coincideixi amb el que diu la constant. Si algú ampliés `DemoAccount` per
  // acceptar qualsevol rol, aquesta primera línia continuaria fent de pany.
  if (role === "admin") return null;
  if (role !== target.role) return null;

  return { tokenHash: data.properties.hashed_token };
}

/**
 * Salta a un compte demo.
 *
 * L'autorització surt de dos llocs segons on ets, i cap dels dos és el que
 * digui el navegador:
 *  - Encara ets l'admin → `getViewer()` ha de dir "admin" i ser el mateix que
 *    va armar el mode PRE.
 *  - Ja estàs dins d'un demo (el teu rol és `trainer` o `client`, o sigui que
 *    `getViewer()` no autoritza res) → mana el bitllet de tornada, que està
 *    xifrat amb la clau del servidor i és httpOnly.
 */
export async function switchToDemoAction(fd: FormData): Promise<void> {
  if (USE_MOCK) redirect(CONFIG);

  const ticket = await readPreTicket();
  if (!ticket) fail(CONFIG, "off");

  const viewer = await getViewer();
  const back = await readBackTicket();
  // On tornar si això no surt bé: si ja estàs saltat, a la teva pantalla
  // d'ara; si no, a la configuració, que és on viu l'interruptor.
  const home = back ? (demoById(viewer?.id)?.home ?? CONFIG) : CONFIG;

  const target = demoBySlug(fd.get("slug"));
  if (!target) fail(home, "slug");

  if (!back) {
    // Primer salt: ets tu, i cal desar el bitllet de tornada ABANS que
    // `verifyOtp` es mengi les galetes de la teva sessió.
    if (!viewer || viewer.role !== "admin" || viewer.id !== ticket.adminId)
      fail(home, "notadmin");

    const supabase = await createClient();
    // `getSession` només per treure el refresh token. Qui ets ho ha dit
    // `getViewer()` dues línies més amunt, que és el camí de confiança.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.refresh_token) fail(home, "nosession");

    const saved = await writeBackTicket({
      adminId: ticket.adminId,
      adminName: ticket.adminName,
      refreshToken: session.refresh_token,
    });
    if (!saved) fail(home, "nosession");
  } else if (!demoById(viewer?.id)) {
    // Hi ha bitllet de tornada però qui mira no és cap dels tres: estat
    // incoherent. No s'endevina.
    fail(home, "notadmin");
  }

  const resolved = await resolveDemoTarget(target);
  if (!resolved) fail(home, "mismatch");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: resolved.tokenHash,
  });
  if (error) fail(home, "verify");

  revalidatePath("/", "layout");
  redirect(target.home);
}

/**
 * Torna a la sessió de l'admin.
 *
 * Es RESTAURA la sessió que ja hi havia (refrescant el seu propi token), no se
 * n'obre una de nova. Si el token ja no val, no s'intenta res més enginyós: es
 * netegen les dues galetes i cap al login amb el motiu escrit. Fallar cap al
 * login és lleig però és correcte; endevinar no ho seria.
 */
export async function returnToAdminAction(): Promise<void> {
  const back = await readBackTicket();
  if (!back) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: back.refreshToken,
  });

  if (error || data.user?.id !== back.adminId) {
    await clearBackTicket();
    await clearPreTicket();
    redirect(
      `/login?error=${encodeURIComponent(
        "La sessió d'administrador ha caducat mentre provaves. Torna a entrar.",
      )}`,
    );
  }

  // El mode PRE es queda armat: has tornat d'un salt, no has plegat.
  await clearBackTicket();
  revalidatePath("/", "layout");
  redirect("/admin");
}

// ─── L'interruptor ──────────────────────────────────────────────────────────

export type PreFormState = { error?: string; ok?: boolean };

/**
 * Arma o desarma el mode PRE en AQUEST navegador.
 *
 * És una preferència personal i no un ajust del centre a posta: hi ha dos
 * admins, i un interruptor a `center_settings` li faria sortir a l'altre un
 * banner i un selector de comptes del no-res. A més, un ajust global se sol
 * quedar encès; una galeta amb caducitat es desarma sola.
 */
export async function setPreModeAction(
  _prev: PreFormState,
  fd: FormData,
): Promise<PreFormState> {
  if (USE_MOCK)
    return { error: "En mode simulació el rol ja es tria al login." };

  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  const on = String(fd.get("on") ?? "") === "1";

  if (!on) {
    await clearBackTicket();
    await clearPreTicket();
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const written = await writePreTicket({
    adminId: viewer.id,
    adminName: viewer.fullName || viewer.email,
  });
  if (!written)
    return {
      error:
        "No s'ha pogut armar: falta SUPABASE_SERVICE_ROLE_KEY al servidor.",
    };

  revalidatePath("/", "layout");
  return { ok: true };
}
