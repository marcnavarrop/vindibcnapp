import "server-only";
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
  NO_BUYER_FOLDER,
  uploadGiftVoucherPdf,
} from "@/lib/data/gift-voucher-doc";

/**
 * Descàrrega del val, per al client que el va comprar i per a l'admin.
 *
 * El fitxer viu en un bucket privat: aquí es comprova qui el demana i, només
 * llavors, es genera una signed URL de cinc minuts cap a la qual es redirigeix.
 * Mateix camí que les factures del professional.
 *
 * Dues rutes la fan servir, una per àrea: `/client/regals/[id]/pdf` i
 * `/admin/vals-regal/[id]/pdf`. Abans l'admin enllaçava la del client, i el
 * middleware el tornava a /admin: no en podia descarregar cap.
 *
 * NO es comprova el toggle del mòdul: qui ja té un val comprat ha de poder
 * recuperar-ne el document encara que el centre hagi deixat de vendre'n.
 */
export async function giftVoucherPdfResponse(_req: Request, id: string): Promise<Response> {
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
    path = await uploadGiftVoucherPdf({
      // Si qui el va comprar s'ha donat de baixa (0123), el val segueix i el
      // PDF es desa a una carpeta sense comprador (només hi arriba l'admin).
      buyerClientId: buyerClientId ?? NO_BUYER_FOLDER,
      voucherId: id,
      content,
    });
    const { setGiftVoucherPdfPath } = await import("@/lib/data/gift-vouchers");
    await setGiftVoucherPdfPath(id, path);
  }

  return NextResponse.redirect(await giftVoucherSignedUrl(path, content));
}
