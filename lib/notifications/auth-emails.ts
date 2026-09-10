import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { appLink } from "@/lib/notifications/brand";
import { renderInviteEmail, renderRecoveryEmail } from "@/lib/notifications/templates";
import { writeLog } from "@/lib/notifications/log";
import { toLocale, type Locale } from "@/lib/i18n/config";
import type { UserRole } from "@/types/database";

/**
 * L'idioma en què llegeix aquesta persona.
 *
 * Els dos correus de compte —invitació i recuperació— sortien SEMPRE en català
 * encara que les seves plantilles ja acceptessin `locale` i les altres tres
 * (benvinguda, canvi de correu i avís al correu vell) sí que l'hi passessin.
 * Un client amb `preferred_language = "es"` demanava restablir la contrasenya i
 * rebia el correu en una llengua que potser no llegeix.
 *
 * Es consulta aquí i no al cridant perquè els dos camins que hi arriben tenen
 * el `profileId` a mà i cap dels dos té el motiu de saber d'idiomes. Si la
 * consulta falla, es cau al català de sempre: un correu en la llengua per
 * defecte és molt millor que cap correu.
 */
async function localeForProfile(profileId: string | null): Promise<Locale | null> {
  if (!profileId) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("preferred_language")
      .eq("id", profileId)
      .maybeSingle();
    return data ? toLocale(data.preferred_language) : null;
  } catch {
    return null;
  }
}

/**
 * Emails de compte (invitació i recuperació). A diferència de les
 * notificacions, aquests els enviem NOSALTRES via Resend (no Supabase), fent
 * servir generateLink per obtenir el token sense que Supabase enviï cap correu.
 * Així queden amb la mateixa marca que la resta i sense dependre de les
 * plantilles del dashboard. Sempre s'envien (no hi ha preferència d'usuari).
 */

/**
 * Enllaç del correu. Apunta a la PÀGINA (no al route handler): la verificació
 * del token es fa amb JS al navegador, així els escànegers d'enllaços dels
 * proveïdors de correu (que fan un GET pla, sense executar JS) no consumeixen el
 * token d'un sol ús abans que l'usuari cliqui.
 */
function callbackUrl(tokenHash: string, type: "invite" | "recovery"): string {
  return appLink(`/auth/update-password?token_hash=${tokenHash}&type=${type}`);
}

/** Envia (best-effort) l'email d'invitació i ho registra al log. */
async function sendInvite(
  profileId: string | null,
  email: string,
  name: string | null,
  tokenHash: string,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html, text } = renderInviteEmail({
    name,
    url: callbackUrl(tokenHash, "invite"),
    locale: await localeForProfile(profileId),
  });
  const res = await sendEmail({ to: email, subject, html, text });
  await writeLog({
    profileId,
    recipient: email,
    eventType: "auth_invite",
    channel: "email",
    status: res.ok ? "sent" : "failed",
    providerId: res.id ?? null,
    error: res.error ?? null,
  });
  return res;
}

/**
 * Crea un usuari i li envia la invitació de marca. La CREACIÓ de l'usuari és
 * obligatòria (si falla, llança); l'EMAIL és best-effort (si Resend falla,
 * l'usuari existeix igualment i l'admin pot reenviar la invitació). Retorna
 * l'id del nou usuari.
 *
 * EL ROL EL FIXA AQUESTA FUNCIÓ, NO EL METADATA
 *
 * Abans el rol viatjava dins de `options.data` i el posava el trigger d'alta.
 * Això volia dir que el rol el decidia el metadata, i el metadata l'escriu qui
 * fa la petició: pel mateix camí, qualsevol es donava d'alta com a admin des de
 * l'endpoint públic amb la clau anon. Des de la 0064 el trigger crea SEMPRE un
 * 'client' i ignora el que digui el metadata.
 *
 * Els professionals (i qualsevol rol que no sigui client) es pugen aquí, amb un
 * UPDATE explícit i la clau de servei. Passa el guardià de la 0063 precisament
 * perquè la clau de servei no té `auth.uid()`: és el camí que ha de poder.
 */
export async function createUserWithInvite(input: {
  email: string;
  fullName: string;
  role: UserRole;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: { data: { full_name: input.fullName } },
  });
  if (error || !data?.user || !data.properties?.hashed_token) {
    throw new Error(error?.message ?? "No s'ha pogut crear l'usuari.");
  }

  // El trigger ja ha creat el perfil com a 'client'. Si tocava un altre rol, es
  // fixa ara. Si això falla, l'alta NO pot continuar: un professional que es
  // quedés com a client entraria a l'àrea equivocada i, pitjor, l'admin creuria
  // que l'ha donat d'alta bé.
  if (input.role !== "client") {
    const { error: roleErr } = await admin
      .from("profiles")
      .update({ role: input.role })
      .eq("id", data.user.id);
    if (roleErr)
      throw new Error(
        `Usuari creat, però no s'ha pogut assignar el rol: ${roleErr.message}`,
      );
  }
  // Email best-effort: no ha de tombar l'alta.
  await sendInvite(
    data.user.id,
    input.email,
    input.fullName,
    data.properties.hashed_token,
  );
  return data.user.id;
}

/**
 * Reenvia la invitació a un usuari que ja existeix (p. ex. l'email no va
 * arribar o va caducar). Fa servir un token de recuperació (l'usuari ja
 * existeix) però amb el text de benvinguda. Retorna {ok,error} per a la UI.
 */
export async function resendInvite(input: {
  profileId: string;
  email: string;
  fullName: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
  });
  if (error || !data?.properties?.hashed_token)
    return { ok: false, error: error?.message ?? "No s'ha pogut generar l'enllaç." };
  return sendInvite(
    input.profileId,
    input.email,
    input.fullName,
    data.properties.hashed_token,
  );
}

/**
 * Envia un email de restabliment de contrasenya. Silenciós si l'email no
 * existeix (no revela comptes). Best-effort + log.
 */
export async function sendPasswordRecovery(email: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  // Usuari inexistent o error → no revelem res (silenciós).
  if (error || !data?.properties?.hashed_token) return;
  // NOMÉS `full_name`. De tot el metadata, aquesta és l'única clau que llegim
  // enlloc del projecte, i convé que segueixi sent així.
  //
  // NO FACIS SERVIR `user_metadata.email`
  //
  // Hi és —la posa GoTrue en donar-se d'alta, amb `email_verified`, `sub` i
  // companyia— i es queda DESFASADA quan algú canvia el correu d'accés.
  // Comprovat contra producció: després d'un canvi confirmat, `auth.users.email`
  // i `identities[].identity_data.email` van al correu nou, i aquesta es queda
  // amb el vell. És una cadena amb bona pinta i valor caducat, que és pitjor que
  // no tenir-ne cap.
  //
  // No la sincronitzem a posta: és columna de GoTrue, que hi escriu ell a cada
  // alta, així que qualsevol còpia nostra la pot desfer ell. Esborrar-la tampoc
  // dura: el registre següent la torna a posar.
  //
  // El correu bo és `auth.users.email` (i, dins de l'app, `profiles.email`, que
  // el segueix des de la 0077). Vegeu la capçalera d'aquella migració.
  const name = (data.user?.user_metadata?.full_name as string | undefined) ?? null;
  const { subject, html, text } = renderRecoveryEmail({
    name,
    url: callbackUrl(data.properties.hashed_token, "recovery"),
    // El perfil ja està resolt aquí: `generateLink` ens torna l'usuari.
    locale: await localeForProfile(data.user?.id ?? null),
  });
  const res = await sendEmail({ to: email, subject, html, text });
  await writeLog({
    profileId: data.user?.id ?? null,
    recipient: email,
    eventType: "auth_recovery",
    channel: "email",
    status: res.ok ? "sent" : "failed",
    providerId: res.id ?? null,
    error: res.error ?? null,
  });
}
