"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import {
  redeemGiftVoucher,
  giftVoucherBuyerContact,
} from "@/lib/data/gift-vouchers";
import { notify, getProfileContact } from "@/lib/notifications";
import { SERVICE_LABELS, deOf, sessionsLabel, formatDate, formatTime } from "@/lib/labels";

export type RedeemState = {
  error?: string;
  ok?: boolean;
  /** Text de l'èxit ("8 sessions d'EP Individual"). */
  detail?: string;
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
  if (!viewer || viewer.role !== "client") return { error: "No autoritzat." };

  const code = String(formData.get("code") ?? "");
  if (!code.trim()) return { error: "Escriu el codi del val." };

  const result = await redeemGiftVoucher({ code, profileId: viewer.id });
  if (!result.ok) return { error: result.error };

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
          when: `${formatDate(new Date().toISOString())}, ${formatTime(new Date().toISOString())}`,
        },
      });
  }

  revalidatePath("/client/bonos");
  revalidatePath("/client");
  return {
    ok: true,
    detail: `${sessionsLabel(result.sessions)} ${deOf(SERVICE_LABELS[result.serviceType])}`,
  };
}
