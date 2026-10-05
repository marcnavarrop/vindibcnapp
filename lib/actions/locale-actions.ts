"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { USE_MOCK } from "@/lib/config";
import { mockFails } from "@/lib/mock/faults";
import { staticI18n } from "@/lib/i18n/no-request";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  toLocale,
  type Locale,
} from "@/lib/i18n/config";

/**
 * `ok: false`: no s'ha pogut desar al perfil. `locale` és el que hi ha DESAT
 * (amb el qual ja s'ha deixat la cookie) i `message`, l'avís escrit en aquest
 * mateix idioma, que és el de la pantalla que es tornarà a pintar.
 */
export type SetLocaleResult = { ok: true } | { ok: false; locale: Locale; message: string };

/**
 * Canvia l'idioma.
 *
 * Escriu SEMPRE la cookie —és el que llegeix el servidor a cada render— i, si
 * qui ho demana és un client amb sessió, també el seu perfil, perquè la tria
 * el segueixi al mòbil i a qualsevol altre navegador.
 *
 * Un visitant sense compte només té la cookie, i n'hi ha prou: no cal fitxa a
 * la base per triar en quin idioma es llegeix una pàgina pública.
 *
 * ─── PER QUÈ EL CLIENT DE SESSIÓ I NO LA CLAU DE SERVEI ───
 *
 * Aquesta acció està muntada a /login, /register i /prova, que són pàgines
 * PÚBLIQUES. Fins ara desava el perfil amb `createAdminClient()`, que se salta
 * la RLS, i el destí de l'escriptura sortia del `viewer`. Amb el matcher
 * positiu d'aleshores, aquelles tres rutes no passaven pel middleware, ningú
 * netejava les capçaleres d'identitat i una petició SENSE cap galeta podia
 * dir-se client i triar el perfil de qualsevol altre. Reproduït de punta a
 * punta: un `PATCH /profiles?id=eq.<qualsevol>` amb la clau de servei.
 *
 * L'arrel ja està tancada al middleware (matcher negatiu + firma), però això
 * era la meitat del problema que depenia d'aquest fitxer: una acció pública no
 * ha de menester saltar-se la RLS per desar una preferència de qui la demana.
 * Amb el client de sessió mana `profiles_update` —`id = auth.uid()`—, que és
 * qui de debò pot dir si aquesta persona pot tocar aquesta fila. Mateix criteri
 * que `completeRegistrationProfileAction`.
 *
 * Conseqüència volguda: si algun dia tornés a arribar un `viewer` que no es
 * correspon amb cap sessió real, l'escriptura no faria res. Falla tancant.
 */
export async function setLocaleAction(value: string): Promise<SetLocaleResult> {
  const locale = toLocale(value);
  const store = await cookies();
  const setCookie = (l: Locale) =>
    store.set(LOCALE_COOKIE, l, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });

  /*
   * El perfil, només per a clients amb sessió. L'admin i el professional
   * treballen en català fix: la seva preferència no ha de decidir res.
   *
   * PRIMER el perfil i DESPRÉS la cookie. Abans era al revés i l'error de la
   * base no es mirava: la pantalla canviava d'idioma i el perfil no, i els
   * correus seguien arribant en l'anterior sense que ningú ho sabés. Ara, si
   * no es pot desar, la cookie es queda amb el que hi ha a la base —la
   * pantalla i els correus coincideixen— i es diu.
   */
  const viewer = await getViewer();
  if (viewer?.role === "client") {
    const failed = await saveProfileLocale(viewer.id, locale);
    if (failed) {
      const saved = (await savedProfileLocale(viewer.id)) ?? toLocale(store.get(LOCALE_COOKIE)?.value);
      setCookie(saved);
      revalidatePath("/", "layout");
      return { ok: false, locale: saved, message: staticI18n(saved).t("config.prefs.languageFailed") };
    }
  }

  setCookie(locale);
  // Tot: el text traduït viu a pantalles que no comparteixen ruta.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Desa l'idioma al perfil. Torna l'error, o null si ha anat bé. */
async function saveProfileLocale(profileId: string, locale: Locale): Promise<string | null> {
  // Per provar què ensenya la pantalla quan la base falla (MOCK_FAIL=locale).
  if (mockFails("locale")) return "error simulat (MOCK_FAIL=locale)";
  if (USE_MOCK) return null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_language: locale })
    .eq("id", profileId);
  if (error) console.error("[idioma] no s'ha pogut desar:", error.message);
  return error ? error.message : null;
}

/** L'idioma desat al perfil, o null si no es pot llegir (o al mode demo). */
async function savedProfileLocale(profileId: string): Promise<Locale | null> {
  if (USE_MOCK) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", profileId)
      .maybeSingle();
    return !error && data ? toLocale(data.preferred_language) : null;
  } catch {
    return null;
  }
}
