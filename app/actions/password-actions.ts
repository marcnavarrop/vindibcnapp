"use server";

import { getViewer } from "@/lib/auth";
import { changeOwnPassword, type PasswordChangeError } from "@/lib/data/password";

/**
 * Canvi de contrasenya des de Configuració, per als tres rols.
 *
 * Viu a `app/actions/` i no dins de l'àrea d'un rol perquè el formulari és el
 * mateix a client, professional i administració.
 *
 * El compte sobre el qual actua surt de `getViewer()` —la cookie de sessió—,
 * mai d'un id que enviï el navegador: si vingués del formulari, qualsevol amb
 * una sessió podria canviar-li la contrasenya a algú altre.
 */
export type PasswordFormState = { errorCode?: PasswordChangeError; ok?: boolean };

export async function changePasswordAction(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const viewer = await getViewer();
  if (!viewer) return { errorCode: "noAccount" };

  const error = await changeOwnPassword({
    profileId: viewer.id,
    email: viewer.email,
    currentPassword: String(formData.get("current") ?? ""),
    newPassword: String(formData.get("password") ?? ""),
  });
  return error ? { errorCode: error } : { ok: true };
}
