"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { getProfileSettings } from "@/lib/data/clients";
import {
  requestEmailChange,
  cancelEmailChange,
  type EmailChangeError,
} from "@/lib/data/email-change";

/**
 * Codi, no frase: com a la resta de Configuració, el motiu el decideix el
 * servidor i el text el posa el diccionari de qui mira la pantalla.
 */
export type EmailFormState = { errorCode?: EmailChangeError; okEmail?: string };

/**
 * Demana canviar el correu d'accés. Sempre acaba amb un enllaç a la bústia
 * NOVA i un avís sense acció a la vella; el canvi no s'aplica fins que algú
 * obre aquell enllaç.
 *
 * La contrasenya la comprova el SERVIDOR (`requestEmailChange`), no aquest
 * formulari: amb la comprovació al navegador, qui tingués la sessió podria
 * cridar aquesta acció directament i saltar-se-la.
 */
export async function requestEmailChangeAction(
  _prev: EmailFormState,
  formData: FormData,
): Promise<EmailFormState> {
  const viewer = await getViewer();
  if (!viewer) return { errorCode: "noAccount" };

  const newEmail = String(formData.get("newEmail") ?? "");
  const password = String(formData.get("password") ?? "");

  const settings = await getProfileSettings(viewer.id);
  if (!settings?.email) return { errorCode: "noAccount" };

  const error = await requestEmailChange({
    profileId: viewer.id,
    currentEmail: settings.email,
    name: settings.fullName || viewer.fullName || null,
    locale: settings.preferredLanguage ?? null,
    newEmail,
    password,
  });
  if (error) return { errorCode: error };

  revalidatePath("/client/configuracio");
  return { okEmail: newEmail.trim().toLowerCase() };
}

/** Anul·la la petició pendent. Sense contrasenya: només tanca el que ja era seu. */
export async function cancelEmailChangeAction(): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  await cancelEmailChange(viewer.id);
  revalidatePath("/client/configuracio");
}
