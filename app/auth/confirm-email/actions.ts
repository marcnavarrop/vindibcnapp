"use server";

import { confirmEmailChange } from "@/lib/data/email-change";

/**
 * Confirma el canvi a partir del secret de l'enllaç.
 *
 * NO demana sessió a posta: qui obre el correu nou pot no tenir-ne cap oberta
 * en aquell navegador, i exigir-la deixaria el canvi a mitges precisament a qui
 * ho ha fet tot bé. L'autorització és el secret, que només ha arribat a la
 * bústia que s'està provant.
 */
export async function confirmEmailChangeAction(
  secret: string,
): Promise<{ ok: true; email: string } | { ok: false }> {
  return confirmEmailChange(secret);
}
