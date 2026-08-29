"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ preferred_language: locale })
      .eq("id", viewer.id);
  }

  // Tot: el text traduït viu a pantalles que no comparteixen ruta.
  revalidatePath("/", "layout");
}
