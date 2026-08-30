"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  redeemGiftVoucher,
  giftVoucherBuyerContact,
} from "@/lib/data/gift-vouchers";
import { notify, getProfileContact } from "@/lib/notifications";
import { sessionsLabel } from "@/lib/labels";
import type { RedeemErrorCode } from "@/lib/data/gift-vouchers";
import type { ServiceType } from "@/types/database";

/**
 * L'estat torna CODIS, no frases.
 *
 * Qui pinta la pantalla sap en quin idioma llegeix el client; aquesta acció,
 * no. Per això el missatge d'error i el detall de l'èxit —"8 sessions ·
 * Fisioteràpia"— es componen allà amb el diccionari.
 */
export type RedeemState = {
  errorCode?: RedeemErrorCode | "empty" | "unauthorized";
  ok?: boolean;
  /** Dades de l'èxit, per compondre el text a la pantalla. */
  sessions?: number;
  serviceType?: ServiceType;
};

/**
 * Bescanvia un codi de regal.
 *
 * NO es comprova el toggle del mòdul: apagar la venda no pot deixar sense
 * sortida algú que ja té un val pagat a la mà. El que sí que es comprova, dins
 * de `redeemGiftVoucher`, és que el val estigui cobrat.
 */
export async function redeemGiftVoucherAction(
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client")
    return { errorCode: "unauthorized" };

  const code = String(formData.get("code") ?? "");
  if (!code.trim()) return { errorCode: "empty" };

  const result = await redeemGiftVoucher({ code, profileId: viewer.id });
  if (!result.ok) return { errorCode: result.code };

  // Avís al comprador: ha pagat un regal i vol saber que ha arribat. Respecta
  // les seves preferències i mai tomba el canvi si falla.
  const buyer = await giftVoucherBuyerContact(result.voucherId);
  if (buyer) {
    const contact = await getProfileContact(buyer.profileId);
    if (contact)
      await notify({
        type: "gift_voucher_redeemed",
        recipient: contact,
        relatedId: result.voucherId,
        data: {
          name: contact.name ?? "",
          recipient: buyer.recipientName ?? "",
          package: `${buyer.packageName} · ${sessionsLabel(result.sessions)}`,
          code: code.trim().toUpperCase(),
          whenIso: new Date().toISOString(),
        },
      });
  }

  revalidatePath("/client/bonos/meus");
  revalidatePath("/client");
  return { ok: true, sessions: result.sessions, serviceType: result.serviceType };
}
