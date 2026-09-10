"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { USE_MOCK } from "@/lib/config";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  toLocale,
} from "@/lib/i18n/config";

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
export async function setLocaleAction(value: string): Promise<void> {
  const locale = toLocale(value);

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  // El perfil, només per a clients amb sessió. L'admin i el professional
  // treballen en català fix: la seva preferència no ha de decidir res.
  const viewer = await getViewer();
  if (viewer?.role === "client" && !USE_MOCK) {
    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({ preferred_language: locale })
      .eq("id", viewer.id);
  }

  // Tot: el text traduït viu a pantalles que no comparteixen ruta.
  revalidatePath("/", "layout");
}
