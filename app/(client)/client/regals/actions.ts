"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { startGiftVoucherCheckout } from "@/lib/data/stripe-checkout";
import { stripeEnabled } from "@/lib/stripe";
import { getCenterSettings } from "@/lib/data/center-settings";
import {
  createGiftVoucher,
  getGiftVoucher,
  setGiftVoucherPdfPath,
  giftVoucherBuyerId,
} from "@/lib/data/gift-vouchers";
import { uploadGiftVoucherPdf } from "@/lib/data/gift-voucher-doc";
import { getClientByProfile } from "@/lib/data/clients";
import { notify } from "@/lib/notifications";
import { resolveLocale } from "@/lib/i18n/resolve";

export type BuyState = {
  errorCode?: "unauthorized" | "errorOff" | "errorPackage" | "errorCreate";
  ok?: boolean;
  /** Dades per a la pantalla d'èxit. */
  voucher?: { id: string; code: string; expiresAt: string; packageName: string };
};

/**
 * Compra d'un val de regal.
 *
 * El toggle es comprova AQUÍ i no només a la pàgina: amagar el botó no impedeix
 * que algú cridi l'acció directament, i vendre un val amb el mòdul apagat
 * deixaria un cobrament que ningú espera.
 */
export async function buyGiftVoucherAction(
  _prev: BuyState,
  formData: FormData,
): Promise<BuyState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const { giftVouchersEnabled } = await getCenterSettings();
  if (!giftVouchersEnabled)
    return { errorCode: "errorOff" };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { errorCode: "errorPackage" };

  let created: { id: string; code: string };
  try {
    created = await createGiftVoucher({
      profileId: viewer.id,
      serviceId,
      recipientName: String(formData.get("recipientName") ?? ""),
      recipientEmail: String(formData.get("recipientEmail") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
  } catch (e) {
    console.error("[regals] no s'ha pogut crear el val:", e);
    return { errorCode: "errorCreate" };
  }

  const voucher = await getGiftVoucher(created.id);
  if (!voucher) return { errorCode: "errorCreate" };

  // El PDF es genera de seguida: qui acaba de comprar vol imprimir-lo ara, no
  // esperar que algú el prepari. Si fallés, el val existeix igualment i es
  // torna a intentar en descarregar-lo; per això no es tomba la compra.
  try {
    const client = await getClientByProfile(viewer.id);
    if (client) {
      const path = await uploadGiftVoucherPdf({
        buyerClientId: client.id,
        voucherId: voucher.id,
        content: {
          code: voucher.code,
          packageName: voucher.packageName,
          serviceType: voucher.serviceType,
          totalSessions: voucher.totalSessions,
          expiresAt: voucher.expiresAt,
          buyerName: viewer.fullName ?? null,
          recipientName: voucher.recipientName,
          message: voucher.message,
        },
      });
      await setGiftVoucherPdfPath(voucher.id, path);
    }
  } catch {
    // Best-effort: el document no és el val, el codi sí.
  }

  revalidatePath("/client/regals");
  revalidatePath("/client/bonos/meus");
  return {
    ok: true,
    voucher: {
      id: voucher.id,
      code: voucher.code,
      expiresAt: voucher.expiresAt,
      packageName: voucher.packageName,
    },
  };
}

export type SendState = {
  errorCode?: "unauthorized" | "errorEmail" | "errorCreate";
  ok?: boolean;
};

/**
 * Envia el codi per correu a qui rep el regal.
 *
 * Va al COS del missatge i no com a adjunt: el PDF viu en un bucket privat i
 * el seu enllaç caduca en cinc minuts, mentre que un codi es pot escriure des
 * del mòbil i no es perd. Qui compra es queda el PDF per imprimir-lo.
 */
export async function sendGiftVoucherAction(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  const voucherId = String(formData.get("voucherId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { errorCode: "errorEmail" };

  // Només el comprador pot enviar el seu val: sense això, qualsevol client
  // podria repartir per correu un val que no és seu si n'endevinés l'id.
  const client = await getClientByProfile(viewer.id);
  const buyerId = await giftVoucherBuyerId(voucherId);
  if (!client || !buyerId || buyerId !== client.id)
    return { errorCode: "unauthorized" };

  const voucher = await getGiftVoucher(voucherId);
  if (!voucher) return { errorCode: "errorCreate" };

  await notify(
    {
      type: "gift_voucher_gifted",
      recipient: {
        profileId: null,
        email,
        phone: null,
        name: voucher.recipientName,
        // L'idioma de qui REGALA, no de qui rep. De qui rep no en sabem res
        // —sovint ni tan sols és client—; de qui compra sí, perquè està
        // fent-ho ara mateix i la cookie ja ho diu. Sense consulta.
        locale: await resolveLocale(),
      },
      relatedId: voucher.id,
      data: {
        name: voucher.recipientName ?? "",
        recipient: voucher.recipientName ?? "",
        buyer: viewer.fullName ?? "",
        code: voucher.code,
        packageName: voucher.packageName,
        sessions: String(voucher.totalSessions),
        expiresIso: voucher.expiresAt,
        message: voucher.message ?? "",
      },
    },
    { ignorePreferences: true },
  );

  return { ok: true };
}

export type CheckoutState = {
  errorCode?: "unauthorized" | "errorOff" | "errorStripeOff" | "errorPackage" | "errorStripe";
};

/**
 * Pagar el val amb targeta: obre la sessió de Stripe i hi envia el client.
 *
 * Com amb els bons, aquí NO es crea res: el val el crea el webhook quan Stripe
 * confirma el cobrament, i neix ja 'active' —no hi ha cap cobrament que el
 * centre hagi de confirmar després—. La dedicatòria viatja a les metadades de
 * la sessió i torna dins l'esdeveniment signat.
 */
export async function startGiftVoucherCheckoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "client") return { errorCode: "unauthorized" };

  // Mateixa comprovació que a la compra al centre, i pel mateix motiu: amagar
  // el botó no impedeix cridar l'acció.
  const { giftVouchersEnabled } = await getCenterSettings();
  if (!giftVouchersEnabled) return { errorCode: "errorOff" };

  if (!stripeEnabled()) return { errorCode: "errorStripeOff" };

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { errorCode: "errorPackage" };

  let result;
  try {
    result = await startGiftVoucherCheckout({
      profileId: viewer.id,
      serviceId,
      email: viewer.email || null,
      recipientName: String(formData.get("recipientName") ?? "") || null,
      recipientEmail: String(formData.get("recipientEmail") ?? "") || null,
      message: String(formData.get("message") ?? "") || null,
    });
  } catch (e) {
    console.error("[regals] no s'ha pogut obrir el pagament:", e);
    return { errorCode: "errorStripe" };
  }

  if ("error" in result) return { errorCode: "errorStripe" };
  redirect(result.url);
}
