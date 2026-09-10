import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";

/**
 * El fre del restabliment de contrasenya (0081).
 *
 * `requestPasswordResetAction` és pública i sense sessió: qualsevol pot demanar
 * que s'enviï un correu a qualsevol adreça. Sense fre, això és una manera
 * d'omplir la bústia d'un client i de cremar la quota d'enviament del centre.
 *
 * DOS EIXOS, PERQUÈ FRENEN COSES DIFERENTS
 *
 *   · Per DESTINATARI (5 minuts, com el canvi de correu de la 0078). És el que
 *     impedeix bombardejar la bústia d'una persona concreta.
 *   · Per IP (5 per hora, com les sessions de prova de la 0018). És el que
 *     impedeix escombrar moltes adreces des d'un sol lloc.
 *
 * El primer sol no bastaria: qui provés mil correus diferents no repetiria mai
 * destinatari. El segon sol tampoc: qui tingués mil IP no repetiria mai IP.
 *
 * ES COMPTEN LES PETICIONS, NO ELS ENVIAMENTS
 *
 * I això és el moll de l'os. `sendPasswordRecovery` surt en SILENCI quan
 * l'adreça no té compte —a posta, per no dir qui és client del centre— i per
 * tant no escriu res a `notification_log`. Si el fre mirés el log d'enviaments,
 * qui provés adreces a l'atzar no en trobaria cap. El raonament és el mateix
 * que ja va escriure la 0078 per al canvi de correu.
 *
 * NO CANVIA LA RESPOSTA
 *
 * Qui demana el restabliment segueix veient sempre el mateix missatge, hi hagi
 * compte o no i s'hagi frenat o no. El fre no pot convertir-se en el detector
 * de clients que la resposta genèrica evita: si diguéssim "massa intents" només
 * quan l'adreça existeix, ho hauríem regalat.
 */

/** Temps mínim entre dues peticions per al mateix correu. Igual que la 0078. */
const COOLDOWN_MINUTES = 5;

/** Peticions per IP i hora. Igual que les sessions de prova. */
const IP_MAX_PER_HOUR = 5;

const HOUR_MS = 3_600_000;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * El fre no ha pogut fer la seva feina: es deixa passar i es CRIDA L'ATENCIÓ.
 *
 * Deixar passar és deliberat —un fre trencat no ha de deixar ningú sense poder
 * recuperar el compte— però fer-ho en silenci no. El cas que això existeix per
 * enxampar és el més probable de tots: desplegar el codi i oblidar-se d'aplicar
 * la migració 0081. Sense aquest missatge, el fre no frenaria res i tot semblaria
 * correcte des de fora durant mesos.
 */
function complain(error: { message?: string; code?: string }): true {
  console.error(
    `[auth] el fre del restabliment no ha funcionat (${error.code ?? "?"}): ` +
      `${error.message ?? "error desconegut"}. ` +
      `Si diu que la taula no existeix, falta aplicar la migració 0081.`,
  );
  return true;
}

/** El correu, normalitzat igual a tot arreu abans de comparar-lo. */
export function normalizeResetEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Deixa passar aquesta petició?
 *
 * Comprova PRIMER i desa DESPRÉS, igual que `requestEmailChange`: així una
 * petició frenada no allarga la seva pròpia penalització.
 *
 * Si la comprovació peta (la base no respon, la taula encara no hi és), es
 * deixa passar i es diu al registre. Un fre trencat no ha de deixar ningú sense
 * poder recuperar el compte; és una protecció contra l'abús, no una porta.
 */
export async function allowPasswordReset(
  email: string,
  ip: string | null,
): Promise<boolean> {
  if (USE_MOCK) return true;

  const emailHash = sha256(normalizeResetEmail(email));
  const ipHash = ip ? sha256(ip) : null;
  const now = Date.now();

  try {
    const admin = createAdminClient();

    const sinceEmail = new Date(now - COOLDOWN_MINUTES * 60_000).toISOString();
    const { count: recent, error: eErr } = await admin
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", emailHash)
      .gt("created_at", sinceEmail);
    if (eErr) return complain(eErr);
    if ((recent ?? 0) > 0) return false;

    if (ipHash) {
      const sinceIp = new Date(now - HOUR_MS).toISOString();
      const { count: fromIp, error: iErr } = await admin
        .from("password_reset_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gt("created_at", sinceIp);
      if (iErr) return complain(iErr);
      if ((fromIp ?? 0) >= IP_MAX_PER_HOUR) return false;
    }

    const { error: insErr } = await admin
      .from("password_reset_requests")
      .insert({ email_hash: emailHash, ip_hash: ipHash });
    // Sense aquesta fila el fre no frenarà la petició següent: es diu.
    if (insErr) return complain(insErr);

    return true;
  } catch (e) {
    console.error("[auth] el fre del restabliment no ha pogut comprovar-se:", e);
    return true;
  }
}

/**
 * Esborra les peticions que ja no frenen res. La crida l'escombrat diari.
 *
 * La finestra més llarga és la de la IP (una hora); es guarda un dia sencer per
 * si algun dia es vol mirar enrere, i s'esborra la resta. Sense això la taula
 * creixeria per sempre amb files que ja no serveixen per a res.
 */
export async function prunePasswordResetRequests(): Promise<number> {
  if (USE_MOCK) return 0;
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - 24 * HOUR_MS).toISOString();
    const { data } = await admin
      .from("password_reset_requests")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    return data?.length ?? 0;
  } catch (e) {
    console.error("[auth] no s'han pogut esborrar les peticions velles:", e);
    return 0;
  }
}
