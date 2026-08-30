import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import {
  getGiftVoucher,
  giftVoucherBuyerId,
  giftVoucherBuyerLocale,
} from "@/lib/data/gift-vouchers";
import {
  giftVoucherSignedUrl,
  uploadGiftVoucherPdf,
} from "@/lib/data/gift-voucher-doc";

export const dynamic = "force-dynamic";

/**
 * Descàrrega del val.
 *
 * El fitxer viu en un bucket privat: aquí es comprova qui el demana i, només
 * llavors, es genera una signed URL de cinc minuts cap a la qual es redirigeix.
 * Mateix camí que les factures del professional.
 *
 * NO es comprova el toggle del mòdul: qui ja té un val comprat ha de poder
 * recuperar-ne el document encara que el centre hagi deixat de vendre'n.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(new URL("/login", _req.url));

  const voucher = await getGiftVoucher(id);
  if (!voucher) return new NextResponse("No trobat", { status: 404 });

  const buyerClientId = await giftVoucherBuyerId(id);

  // L'admin pot descarregar qualsevol val (li'l poden demanar per telèfon);
  // un client, només els que ha comprat ell.
  if (viewer.role !== "admin") {
    const client = await getClientByProfile(viewer.id);
    if (!client || !buyerClientId || buyerClientId !== client.id)
      return new NextResponse("No autoritzat", { status: 403 });
  }

  // L'idioma és el de qui va COMPRAR el val, encara que qui el descarregui
  // ara sigui l'admin: el document és seu, no de qui el baixa.
  const content = {
    locale: buyerClientId ? await giftVoucherBuyerLocale(buyerClientId) : null,
    code: voucher.code,
    packageName: voucher.packageName,
    serviceType: voucher.serviceType,
    totalSessions: voucher.totalSessions,
    expiresAt: voucher.expiresAt,
    buyerName: voucher.buyerName,
    recipientName: voucher.recipientName,
    message: voucher.message,
  };

  // Si la generació del moment de la compra va fallar, es torna a intentar
  // aquí en comptes de deixar el botó mort.
  let path = voucher.pdfPath;
  if (!path) {
    if (!buyerClientId) return new NextResponse("No trobat", { status: 404 });
    path = await uploadGiftVoucherPdf({
      buyerClientId,
      voucherId: id,
      content,
    });
    const { setGiftVoucherPdfPath } = await import("@/lib/data/gift-vouchers");
    await setGiftVoucherPdfPath(id, path);
  }

  return NextResponse.redirect(await giftVoucherSignedUrl(path, content));
}
