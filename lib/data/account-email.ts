import "server-only";

import { USE_MOCK } from "@/lib/config";
import { getStore } from "@/lib/mock/store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

/**
 * UN CORREU, UN COMPTE: la comprovació d'abans de donar d'alta ningú.
 *
 * L'alta d'un client (o d'un professional) crea l'usuari a Auth i, darrere,
 * el perfil. Fins ara no es mirava res abans: en simulació s'acabava creant un
 * segon client amb el mateix correu, i a la base de debò l'error d'Auth
 * arribava a la pantalla tal qual, en anglès. Ara es mira PRIMER, i si el
 * correu ja és d'algú no es crea res i es diu de qui és.
 *
 * Es mira a `profiles`, que és la còpia d'`auth.users` (el trigger en fa una
 * per usuari; comprovat a producció el 2026-10-02: 9 i 9, mateix correu). El
 * correu es compara sense espais i sense majúscules, i els comodins d'`ilike`
 * (`%`, `_`) s'escapen: sense això «ana_p@…» casaria amb «anaxp@…».
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Escapa els comodins de LIKE perquè `ilike` compari el text tal qual. */
function likeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type ExistingAccount = {
  profileId: string;
  role: UserRole;
  fullName: string | null;
  /** Si és un client, la seva fitxa: la pantalla hi pot enllaçar. */
  clientId: string | null;
};

export async function findAccountByEmail(email: string): Promise<ExistingAccount | null> {
  const target = normalizeEmail(email);
  if (!target) return null;

  if (USE_MOCK) {
    const store = getStore();
    const p = store.profiles.find((x) => normalizeEmail(x.email ?? "") === target);
    if (!p) return null;
    return {
      profileId: p.id,
      role: p.role,
      fullName: p.full_name,
      clientId: store.clients.find((c) => c.profile_id === p.id)?.id ?? null,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, role, full_name, email")
    .ilike("email", likeLiteral(target))
    .limit(5);
  // Si no es pot comprovar, no es crea: millor un «torna-ho a provar» que un
  // compte duplicat.
  if (error) throw new Error("No s'ha pogut comprovar si el correu ja existeix. No s'ha creat res.");
  const p = (data ?? []).find((x) => normalizeEmail(x.email ?? "") === target);
  if (!p) return null;
  const { data: c } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", p.id)
    .maybeSingle();
  return { profileId: p.id, role: p.role, fullName: p.full_name, clientId: c?.id ?? null };
}

/**
 * El correu ja és d'algú. Porta la fitxa del client, si n'és un, perquè l'alta
 * pugui dir «obre la seva fitxa» en lloc d'un error sense sortida.
 */
export class EmailTakenError extends Error {
  readonly existingClientId: string | null;
  constructor(existing: ExistingAccount) {
    super(emailTakenMessage(existing));
    this.name = "EmailTakenError";
    this.existingClientId = existing.clientId;
  }
}

/**
 * Què li diem a l'admin. Ell sí que pot saber de qui és el correu: és qui
 * gestiona tots els comptes (l'alta pública, en canvi, no ho diu mai).
 */
export function emailTakenMessage(e: ExistingAccount): string {
  const who = e.fullName?.trim() || "sense nom";
  if (e.role === "client")
    return `Ja hi ha un client amb aquest correu: ${who}. No s'ha creat res.`;
  const whose = e.role === "trainer" ? "un professional" : "un compte de l'administració";
  return `Aquest correu ja és d'${whose} del centre (${who}). No s'ha creat res: cada compte necessita un correu propi.`;
}

/** Llança `EmailTakenError` si el correu ja té compte. Va abans de crear res. */
export async function assertEmailFree(email: string): Promise<void> {
  const existing = await findAccountByEmail(email);
  if (existing) throw new EmailTakenError(existing);
}
