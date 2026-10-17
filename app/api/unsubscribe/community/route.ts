import { NextResponse } from "next/server";
import { verifyUnsubscribe } from "@/lib/unsubscribe";
import { unsubscribeCommunity } from "@/lib/data/community-notice";

export const dynamic = "force-dynamic";

/**
 * La baixa d'un sol clic dels clients de correu (RFC 8058): el botó «Donar-se de
 * baixa» de Gmail o Apple Mail fa un POST a l'adreça de `List-Unsubscribe`. Sense
 * sessió: la barrera és la signatura (lib/unsubscribe.ts).
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams.get("p");
  const t = url.searchParams.get("t");
  if (!verifyUnsubscribe(p, t)) return new NextResponse("Invalid link", { status: 400 });
  try {
    await unsubscribeCommunity(p!);
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
  return new NextResponse("OK", { status: 200 });
}

/** Un GET (algú que l'obre a mà) va a la pàgina, que demana confirmar. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = new URL("/baixa/comunitat", url.origin);
  for (const k of ["p", "t"]) {
    const v = url.searchParams.get(k);
    if (v) to.searchParams.set(k, v);
  }
  return NextResponse.redirect(to, 303);
}
