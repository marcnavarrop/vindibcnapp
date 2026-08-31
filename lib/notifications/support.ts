import "server-only";
import { notify } from "@/lib/notifications/index";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/labels";
import type { SupportTicket } from "@/lib/data/support";

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
