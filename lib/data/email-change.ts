import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";
import { appLink } from "@/lib/notifications/brand";
import {
  renderEmailChangeEmail,
  renderEmailChangeAlertEmail,
} from "@/lib/notifications/templates";
import { sendEmail } from "@/lib/email";
import { writeLog } from "@/lib/notifications/log";
import type { Locale } from "@/lib/i18n/config";

/**
 * Canvi del correu d'ACCÉS d'una persona, en dos temps: es demana des de
 * Configuració i es confirma des de la bústia NOVA.
 *
 * PER QUÈ NO FEM SERVIR EL CAMÍ NATIU DE SUPABASE
 *
 * `supabase.auth.updateUser({ email })` funciona, però envia ell mateix dos
 * correus —un al nou i un al vell— amb la plantilla per defecte, en anglès i
 * fora del nostre `notification_log`. I el del correu VELL porta un enllaç VIU:
 * comprovat contra el projecte real, un sol clic des de l'adreça antiga va
 * completar el canvi. L'avís que hauria de ser la xarxa de seguretat és el
 * botó que remata el robatori si algú ha agafat la sessió.
 *
 * Aquí el fem nosaltres: enllaç només al correu nou, avís sense cap acció al
 * vell, i tot en l'idioma de qui ho rep.
 *
 * COM ES CONFIRMA (i per què hi ha una taula pel mig)
 *
 * L'enllaç del correu porta un secret NOSTRE. Quan la pàgina el presenta,
 * l'encunyat del token de GoTrue i la seva verificació passen al SERVIDOR.
 * Això és el que impedeix que un escàner d'enllaços consumeixi el que ha de
 * consumir una persona —la mateixa raó de `/auth/update-password`—, i aquí
 * calia aquesta volta perquè `verifyOtp` no accepta els tokens de canvi de
 * correu. La 0078 ho documenta amb les sis proves.
 */

/** Quant dura l'enllaç. Igual que el token de GoTrue que embolcalla. */
const TTL_HOURS = 24;

/** Temps mínim entre dues peticions del mateix perfil. */
const COOLDOWN_MINUTES = 5;

export type EmailChangeError =
  | "invalid"
  | "same"
  | "taken"
  | "wrongPassword"
  | "noAccount"
  | "tooSoon"
  | "failed";

export type PendingEmailChange = { newEmail: string; requestedAt: string };

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Comprova la contrasenya AL SERVIDOR, sense tocar la sessió de qui ho demana.
 *
 * `ChangePasswordForm` fa la reautenticació al navegador, i allà és un
 * ressalt: qui tingui la sessió pot cridar l'acció del servidor directament i
 * saltar-se-la. Aquí la comprovació la fa el servidor amb un client d'un sol
 * ús —sense persistir sessió— i el resultat el decideix Supabase, no el
 * formulari. Es tanca la sessió que aquest login crea perquè no quedi cap
 * refresh token viu per una comprovació.
 */
async function passwordIsCorrect(email: string, password: string): Promise<boolean> {
  const probe = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return false;
  await probe.auth.signOut().catch(() => {});
  return true;
}

/** La petició pendent d'un perfil, si n'hi ha cap de viva. */
export async function getPendingEmailChange(
  profileId: string,
): Promise<PendingEmailChange | null> {
  if (USE_MOCK) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("email_change_requests")
    .select("new_email, created_at, expires_at")
    .eq("profile_id", profileId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { newEmail: data.new_email, requestedAt: data.created_at } : null;
}

/** Anul·la les peticions vives d'un perfil. Idempotent. */
export async function cancelEmailChange(profileId: string): Promise<void> {
  if (USE_MOCK) return;
  const admin = createAdminClient();
  await admin
    .from("email_change_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("consumed_at", null);
}

/**
 * Demana el canvi. Retorna `null` si tot ha anat bé, o el motiu de l'error.
 *
 * L'ORDRE DE LES COMPROVACIONS IMPORTA: la contrasenya es comprova ABANS de
 * dir res sobre el correu de destí. Al revés, qualsevol amb una sessió oberta
 * podria fer servir aquest formulari per esbrinar si una adreça té compte al
 * centre sense saber ni la seva pròpia contrasenya.
 */
export async function requestEmailChange(input: {
  profileId: string;
  currentEmail: string;
  name: string | null;
  locale: Locale | null;
  newEmail: string;
  password: string;
}): Promise<EmailChangeError | null> {
  const newEmail = input.newEmail.trim().toLowerCase();
  const currentEmail = input.currentEmail.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return "invalid";
  if (newEmail === currentEmail) return "same";
  if (!input.password) return "wrongPassword";
  if (USE_MOCK) return "failed";

  if (!(await passwordIsCorrect(currentEmail, input.password)))
    return "wrongPassword";

  const admin = createAdminClient();

  // Correu ja fet servir. El missatge que veurà qui ho demani és genèric ("no
  // es pot fer servir") a posta: dir "ja té compte" convertiria el formulari en
  // un detector de clients del centre.
  const { data: taken } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", newEmail)
    .limit(1)
    .maybeSingle();
  if (taken) return "taken";

  // Cooldown: mirat sobre les peticions, no sobre el log d'enviaments, perquè
  // una petició compta encara que el correu no hagi arribat a sortir.
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString();
  const { count: recent } = await admin
    .from("email_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", input.profileId)
    .gt("created_at", since);
  if ((recent ?? 0) > 0) return "tooSoon";

  // Una petició nova anul·la les anteriors: només l'últim enllaç enviat val.
  await cancelEmailChange(input.profileId);

  const secret = randomBytes(32).toString("base64url");
  const { error: insErr } = await admin.from("email_change_requests").insert({
    profile_id: input.profileId,
    new_email: newEmail,
    token_hash: sha256(secret),
    expires_at: new Date(Date.now() + TTL_HOURS * 3_600_000).toISOString(),
  });
  if (insErr) return "failed";

  // Enllaç al correu NOU. És l'únic dels dos que porta acció.
  const rendered = renderEmailChangeEmail({
    name: input.name,
    url: appLink(`/auth/confirm-email?r=${secret}`),
    locale: input.locale,
  });
  const res = await sendEmail({
    to: newEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  await writeLog({
    profileId: input.profileId,
    recipient: newEmail,
    eventType: "auth_email_change",
    channel: "email",
    status: res.ok ? "sent" : "failed",
    providerId: res.id ?? null,
    error: res.error ?? null,
  });

  // Avís al correu VELL, sense enllaç. Best-effort i a part: si aquest falla,
  // la petició segueix sent vàlida —el que no pot passar és el contrari, que
  // el canvi tiri endavant sense que l'adreça antiga se n'assabenti si arriba.
  const alert = renderEmailChangeAlertEmail({
    name: input.name,
    oldEmail: currentEmail,
    newEmail,
    locale: input.locale,
  });
  const alertRes = await sendEmail({
    to: currentEmail,
    subject: alert.subject,
    html: alert.html,
    text: alert.text,
  });
  await writeLog({
    profileId: input.profileId,
    recipient: currentEmail,
    eventType: "auth_email_change_alert",
    channel: "email",
    status: alertRes.ok ? "sent" : "failed",
    providerId: alertRes.id ?? null,
    error: alertRes.error ?? null,
  });

  // Si el correu del NOU no ha sortit, la petició no serveix de res: ningú no
  // rebrà mai l'enllaç. Es diu, en comptes de fer veure que s'ha enviat.
  return res.ok ? null : "failed";
}

/**
 * Confirma una petició a partir del secret de l'enllaç. Torna el correu nou si
 * ha anat bé.
 *
 * El token de GoTrue s'encunya AQUÍ i es gasta immediatament: no es desa
 * enlloc, de manera que la taula no conté cap secret viu.
 */
export async function confirmEmailChange(
  secret: string,
): Promise<{ ok: true; email: string } | { ok: false }> {
  if (USE_MOCK || !secret) return { ok: false };
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("email_change_requests")
    .select("id, profile_id, new_email, expires_at, consumed_at")
    .eq("token_hash", sha256(secret))
    .maybeSingle();
  if (!req || req.consumed_at || new Date(req.expires_at) <= new Date())
    return { ok: false };

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", req.profile_id)
    .maybeSingle();
  if (!profile?.email) return { ok: false };

  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "email_change_new",
    email: profile.email,
    newEmail: req.new_email,
  });
  const actionLink = link?.properties?.action_link;
  if (error || !actionLink) return { ok: false };

  // El GET és el que aplica el canvi: és l'ÚNIC camí que GoTrue accepta per a
  // un token de canvi de correu (`verifyOtp` el rebutja; vegeu la 0078). Es fa
  // des del servidor, no des del navegador, perquè la redirecció final porta
  // tokens de sessió a l'adreça i no han de passar per enlloc més.
  const res = await fetch(actionLink, { redirect: "manual" });
  if (res.status >= 400) return { ok: false };

  // Es marca consumida DESPRÉS: si el GET falla, l'enllaç encara val.
  await admin
    .from("email_change_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", req.id);

  // `profiles.email` el sincronitza el trigger de la 0077. No s'escriu aquí a
  // posta: dues escriptures del mateix valor són dues maneres de divergir.
  return { ok: true, email: req.new_email };
}
