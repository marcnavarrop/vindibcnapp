import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import {
  getGiftVoucherByStripeSession,
  giftVoucherBuyerId,
} from "@/lib/data/gift-vouchers";
import { VoucherReady } from "@/components/forms/gift-voucher-form";
import { AwaitingPayment } from "@/components/ui/awaiting-payment";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

/**
 * Tornada del pagament amb targeta d'un val de regal.
 *
 * Com la dels bons: aquí no es crea res, només es mira si el webhook ja ha
 * passat. Un cop hi és, s'ensenya la MATEIXA pantalla que la compra al centre
 * —codi, descàrrega del PDF i enviament per correu— perquè el que has comprat
 * es fa igual servir hagis pagat com hagis pagat.
 */
export default async function GiftVoucherConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/client/regals");

  const t = await getTranslations("gifts");
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const voucher = await getGiftVoucherByStripeSession(sessionId);

  // El val ha de ser d'aquest comprador: un session_id que no és teu no et pot
  // ensenyar mai el codi d'un val d'algú altre.
  const buyerId = voucher ? await giftVoucherBuyerId(voucher.id) : null;
  const mine = voucher && client && buyerId === client.id;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">{t("title")}</h1>
      <p className="mb-6 text-sm text-brand-muted">
        {mine
          ? t("confirmIntro")
          : t("confirmIntroWait")}
      </p>

      {!mine ? (
        <AwaitingPayment
          fallbackHref="/client/regals"
          fallbackLabel={t("backToGifts")}
        />
      ) : (
        <VoucherReady
          voucher={{
            id: voucher.id,
            code: voucher.code,
            expiresAt: voucher.expiresAt,
            packageName: voucher.packageName,
          }}
          defaultEmail={voucher.recipientEmail ?? ""}
          recipientName={voucher.recipientName ?? ""}
          alreadyPaid
        />
      )}
    </main>
  );
}
