"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getClient } from "@/lib/data/clients";
import { deleteClient } from "@/lib/data/gdpr-delete";
import { logDataAccess } from "@/lib/data/data-access-log";
import { getClinicalRetention } from "@/lib/data/clinical-archive";
import { staticI18n } from "@/lib/i18n/no-request";
import { LOCALES } from "@/lib/i18n/config";
import {
  PRE_BLOCKED_MESSAGE,
  preModeBlocksPersonalData,
} from "@/lib/pre-mode";

export type FormState = { error?: string };

/** El que diu la confirmació de la baixa sobre l'historial clínic (0119). */
export type DeletionPreview =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Sense historial: no s'arxiva res i no cal dir res més. */
      archive: null | {
        /** `dd/mm/aaaa`. */
        until: string;
        isDemo: boolean;
        /** El text per a qui ha demanat la supressió, en els tres idiomes. */
        texts: { locale: string; text: string }[];
      };
    };

const ddmmyyyy = (day: string) => day.split("-").reverse().join("/");

/**
 * Abans de confirmar la baixa: té historial clínic? Fins quan es conservarà?
 * Només l'admin (la consulta va amb la clau de servei).
 */
export async function deletionPreviewAction(clientId: string): Promise<DeletionPreview> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { ok: false, error: "No autoritzat." };
  let r;
  try {
    r = await getClinicalRetention(clientId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No s'ha pogut consultar l'historial clínic." };
  }
  if (!r) return { ok: false, error: "Client no trobat." };
  if (!r.hasHistory || !r.purgeAfter) return { ok: true, archive: null };
  const until = ddmmyyyy(r.purgeAfter);
  // Els tres idiomes alhora, i no el de la petició: `staticI18n` (el de
  // `getTranslations` els tornava tots en català).
  const texts = LOCALES.map((locale) => ({
    locale,
    text: staticI18n(locale).ns("clinicalErasure")("text", { date: until }),
  }));
  return { ok: true, archive: { until, isDemo: r.isDemo, texts } };
}

/**
 * Supressió d'un client (dret a l'oblit). Doble confirmació: cal escriure el
 * nom exacte del client. Registra l'acció a data_access_log.
 */
export async function deleteClientAction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { error: "No autoritzat." };

  // Mateix fre que a l'exportació, i pel mateix motiu: esborrar dades personals
  // és irreversible i deixa constància a `data_access_log`. Amb el mode PRE
  // armat no es fa. Vegeu lib/pre-mode.ts.
  if (await preModeBlocksPersonalData()) return { error: PRE_BLOCKED_MESSAGE };

  const client = await getClient(clientId);
  if (!client) return { error: "Client no trobat." };

  const typed = String(formData.get("confirmName") ?? "").trim();
  if (typed.toLowerCase() !== client.fullName.trim().toLowerCase())
    return { error: "El nom introduït no coincideix amb el del client." };

  let result;
  try {
    result = await deleteClient(clientId, viewer.id);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No s'ha pogut eliminar el client.",
    };
  }
  if (!result) return { error: "Client no trobat." };

  try {
    await logDataAccess({
      actorId: viewer.id,
      subjectProfileId: result.profileId,
      subjectLabel: result.label,
      action: "delete",
      details:
        `Supressió des de la fitxa (client ${clientId}).` +
        (result.archive.archived
          ? ` Historial clínic arxivat fins al ${ddmmyyyy(result.archive.purgeAfter)} (arxiu ${result.archive.patientId}).`
          : ""),
    });
  } catch {
    // El registre és best-effort; no revertim la supressió si el log falla.
  }

  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}
