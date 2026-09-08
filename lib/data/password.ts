import "server-only";
import { createClient } from "@/lib/supabase/server";
import { passwordIsCorrect } from "@/lib/data/reauth";
import { USE_MOCK } from "@/lib/config";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

/**
 * Canvi voluntari de contrasenya de qui té la sessió oberta.
 *
 * Serveix els tres rols: la secció de Configuració és la mateixa a client,
 * professional i administració.
 *
 * TOT PASSA AL SERVIDOR, PERÒ AMB LA SESSIÓ DE LA PERSONA
 *
 * Abans les dues coses passaven al navegador: `signInWithPassword` per
 * reautenticar i `updateUser({password})` per desar. La primera era un ressalt
 * —qui tingués la sessió podia saltar-se-la— i ara la fa el servidor.
 *
 * La segona, en canvi, s'aplica amb el client de SERVIDOR, que és el que porta
 * les cookies de qui ho demana. No amb l'Admin API, i el motiu és concret:
 * `admin.updateUserById({password})` revoca els refresh tokens de la persona i
 * la treu del seu propi navegador. Provat en producció: la contrasenya es
 * canviava bé i tot seguit queia al login. És el mateix mal que el `signOut`
 * global de 2f0b6ee per una porta diferent.
 *
 * Fent-ho amb la seva sessió, GoTrue la conserva —tanca les ALTRES, que és el
 * que toca en canviar una contrasenya— i el client de servidor reescriu les
 * cookies noves. Per fora es comporta igual que abans del canvi.
 */
export type PasswordChangeError =
  | "tooShort"
  | "same"
  | "noAccount"
  | "wrongCurrent"
  | "failed";

export async function changeOwnPassword(input: {
  /** El correu de qui té la sessió: només per reautenticar, no per triar compte.
   *  El compte sobre el qual s'actua el decideixen les cookies. */
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<PasswordChangeError | null> {
  // Les mateixes regles que el formulari, però aquí manen. Les del navegador
  // són comoditat: es desactiven des de la consola en dues línies.
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (input.newPassword === input.currentPassword) return "same";
  if (!input.email) return "noAccount";
  if (USE_MOCK) return "failed";

  if (!(await passwordIsCorrect(input.email, input.currentPassword)))
    return "wrongCurrent";

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  return error ? "failed" : null;
}
