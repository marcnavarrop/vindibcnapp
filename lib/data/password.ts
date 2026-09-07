import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordIsCorrect } from "@/lib/data/reauth";
import { USE_MOCK } from "@/lib/config";

/**
 * Canvi voluntari de contrasenya de qui té la sessió oberta.
 *
 * Serveix els tres rols: la secció de Configuració és la mateixa a client,
 * professional i administració.
 *
 * L'APLICA L'ADMIN API, NO EL NAVEGADOR
 *
 * Abans tot passava al client: `signInWithPassword` per reautenticar i
 * `updateUser({password})` per desar. Ara les dues coses passen aquí, amb la
 * contrasenya nova viatjant una sola vegada cap al servidor i sense que el
 * navegador pugui decidir si la reautenticació ha anat bé.
 *
 * `updateUserById` NO tanca cap sessió: la de qui fa el canvi segueix oberta,
 * que és el que la persona espera. La sessió que obre la comprovació de la
 * contrasenya es tanca amb `scope: "local"` (vegeu `lib/data/reauth.ts`).
 */
export type PasswordChangeError =
  | "tooShort"
  | "same"
  | "noAccount"
  | "wrongCurrent"
  | "failed";

/** Mínim de caràcters. El mateix que ja demanava el formulari. */
const MIN_LENGTH = 8;

export async function changeOwnPassword(input: {
  profileId: string;
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<PasswordChangeError | null> {
  // Les mateixes regles que el formulari, però aquí manen. Les del navegador
  // són comoditat: es desactiven des de la consola en dues línies.
  if (input.newPassword.length < MIN_LENGTH) return "tooShort";
  if (input.newPassword === input.currentPassword) return "same";
  if (!input.email) return "noAccount";
  if (USE_MOCK) return "failed";

  if (!(await passwordIsCorrect(input.email, input.currentPassword)))
    return "wrongCurrent";

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(input.profileId, {
    password: input.newPassword,
  });
  return error ? "failed" : null;
}
