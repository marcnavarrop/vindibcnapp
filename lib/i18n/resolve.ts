import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, toLocale, type Locale } from "@/lib/i18n/config";

/**
 * L'idioma de qui està mirant la pàgina.
 *
 * Surt de la COOKIE i prou. No consulta el perfil aquí, i és deliberat: això
 * corre a cada render, i afegir-hi un viatge a la base per una cadena de dos
 * caràcters seria car per a res. La cookie es manté sincronitzada amb el perfil
 * des del middleware (a cada navegació protegida) i des del selector de
 * Configuració, de manera que el que hi ha és el que la persona ha triat.
 *
 * Un visitant sense compte només té la cookie, i li serveix igual.
 */
export async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  return toLocale(store.get(LOCALE_COOKIE)?.value);
}
