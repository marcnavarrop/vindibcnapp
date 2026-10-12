import "server-only";
import { getProfileContact, notify } from "@/lib/notifications/index";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "@/lib/labels";
import { USE_MOCK } from "@/lib/config";
import { getStore } from "@/lib/mock/store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupportTicket } from "@/lib/data/support";
import type { SupportStatus } from "@/types/database";

/**
 * Adreça de qui desenvolupa l'app.
 *
 * Escrita aquí i no a `center_settings` a propòsit: no és un ajust del centre
 * ni una decisió que l'admin hagi de prendre, és a qui li arriben els tiquets
 * d'aquesta instal·lació. Fer-la configurable només afegiria una pantalla per
 * a un valor que no canvia i que, si algú l'esborrés, deixaria el suport mut
 * sense que ningú se n'adonés.
 */
const DEVELOPER_EMAIL = "marc.navarro.p@gmail.com";

/**
 * Avisa qui desenvolupa l'app que hi ha un tiquet nou.
 *
 * Passa pel `notify()` de sempre en comptes d'enviar un correu a banda:
 * el framework ja preveu un destinatari sense compte (`profileId: null`, el
 * mateix cas que un visitant que demana una sessió de prova), i així el correu
 * surt amb la marca, queda registrat a `notification_log` —si un dia no
 * arriba, es pot mirar— i hereta el "mai llança" de notify.
 *
 * `ignorePreferences` perquè el destinatari no té perfil ni, per tant, cap
 * pantalla de preferències on dir si el vol: és el mateix tracte que
 * `invoice_generated`.
 */
export async function notifySupportTicket(
  ticket: SupportTicket,
  area: "Administració" | "Professional",
  /** El correu de qui l'obre: el Reply-To, perquè respondre li arribi a ell. */
  reporterEmail: string | null,
): Promise<void> {
  await notify(
    {
      type: "support_ticket_created",
      recipient: {
        profileId: null,
        email: DEVELOPER_EMAIL,
        phone: null,
        name: null,
      },
      relatedId: ticket.id,
      data: {
        title: ticket.title,
        category: SUPPORT_CATEGORY_LABELS[ticket.category],
        reporter: ticket.authorName,
        ...(reporterEmail ? { reporterEmail } : {}),
        area,
        description: ticket.description,
        // L'ISO: la plantilla el formata amb la zona del centre i en
        // l'idioma que toqui. Amb `when` ja fet, la fila "Data" es perdia.
        whenIso: ticket.createdAt,
      },
    },
    { ignorePreferences: true },
  );
}

/**
 * Avisa qui va obrir un tiquet que ja té resposta (0106).
 *
 * Sempre (`ignorePreferences`): és la resposta al que va preguntar, i sense el
 * correu quedaria en una pantalla que no té cap motiu per tornar a obrir.
 * Hereta el "mai llança" de `notify`: la resposta ja és desada.
 */
export async function notifySupportAnswer(input: {
  ticketId: string;
  authorId: string;
  title: string;
  answer: string;
  status: SupportStatus;
  answeredByName: string;
  /** El Reply-To: respondre el correu arriba a qui ha respost el tiquet. */
  answeredByEmail: string | null;
}): Promise<void> {
  const recipient = await getProfileContact(input.authorId);
  if (!recipient?.email) return;
  await notify(
    {
      type: "support_ticket_answered",
      recipient,
      relatedId: input.ticketId,
      data: {
        title: input.title,
        answer: input.answer,
        status: SUPPORT_STATUS_LABELS[input.status],
        statusKey: input.status,
        answeredBy: input.answeredByName,
        ...(input.answeredByEmail ? { answeredByEmail: input.answeredByEmail } : {}),
        // L'enllaç porta a la pantalla de suport de la seva àrea.
        area: (await isAdminProfile(input.authorId)) ? "admin" : "trainer",
      },
    },
    { ignorePreferences: true },
  );
}

async function isAdminProfile(profileId: string): Promise<boolean> {
  if (USE_MOCK)
    return getStore().profiles.find((p) => p.id === profileId)?.role === "admin";
  const { data } = await createAdminClient()
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  return data?.role === "admin";
}
