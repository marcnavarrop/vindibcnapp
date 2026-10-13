import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * La imatge que surt en compartir un enllaç (WhatsApp, Instagram, correu…).
 *
 * Es genera amb el logo i els colors de la marca en lloc de fer servir una
 * foto: el centre encara no ha triat cap foto per a això, i una imatge
 * inventada no hi pinta res. Quan n'hi hagi una, n'hi ha prou de canviar-la
 * aquí.
 *
 * Els crawlers (WhatsApp, Facebook…) no porten la galeta d'idioma: el text va
 * en català, l'idioma de la casa.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export async function brandOgImage({ title, subtitle }: { title: string; subtitle: string }) {
  // El logo viatja dins de la funció (`outputFileTracingIncludes` de
  // next.config.ts): a Vercel, `public/` no és al sistema de fitxers.
  const logo = await readFile(path.join(process.cwd(), "public/images/logo-vindi.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          // Tot centrat: WhatsApp de vegades en fa una miniatura quadrada
          // retallant pel mig, i el logo a l'esquerra quedava tallat.
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          padding: "64px 80px",
          textAlign: "center",
          color: "#ffffff",
          background: "linear-gradient(160deg, #3d0f3c 0%, #642263 45%, #4a1749 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={299} height={120} alt="Vindi" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 34, color: "rgba(255,255,255,0.78)" }}>{subtitle}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
