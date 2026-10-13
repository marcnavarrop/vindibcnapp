import { NextResponse } from "next/server";

/**
 * Receptor dels avisos de la CSP (`Content-Security-Policy-Report-Only`).
 *
 * El navegador hi envia què hauria bloquejat la política si fos de debò. Aquí
 * només es deixa una línia als registres de Vercel ([csp] …) per poder-ho
 * revisar abans de passar la CSP a obligatòria. No es desa res a la base ni
 * es respon res: és públic per força (l'envia el navegador sense sessió), i el
 * pitjor que pot fer algú és omplir el registre.
 *
 * Arriben en dos formats: l'antic `report-uri` (un objecte `csp-report`) i el
 * nou (`body`), en llista (Chromium, que els agrupa i els envia al cap d'una
 * estona) o d'un en un (Safari).
 */
export async function POST(request: Request) {
  try {
    const text = (await request.text()).slice(0, 8000);
    const data = JSON.parse(text) as unknown;
    // Llista (Chromium, `report-to`) o un sol informe (Safari); amb el detall
    // dins de `body` (format nou) o de `csp-report` (format antic).
    const list = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
    const reports = list.map((r) => (r?.["csp-report"] ?? r?.body ?? r) as Record<string, unknown>);
    for (const r of reports.slice(0, 10)) {
      const blocked = r["blocked-uri"] ?? r.blockedURL ?? "?";
      const directive = r["violated-directive"] ?? r["effective-directive"] ?? r.effectiveDirective ?? "?";
      const page = r["document-uri"] ?? r.documentURL ?? "?";
      console.warn(`[csp] ${directive} bloquejaria ${blocked} a ${page}`);
    }
  } catch {
    // Un cos que no és JSON: res a fer.
  }
  return new NextResponse(null, { status: 204 });
}
