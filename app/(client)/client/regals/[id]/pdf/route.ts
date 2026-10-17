import { giftVoucherPdfResponse } from "@/lib/gift-voucher-pdf-response";

export const dynamic = "force-dynamic";

/** El PDF d'un val que ha comprat el client (lib/gift-voucher-pdf-response.ts). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return giftVoucherPdfResponse(req, id);
}
