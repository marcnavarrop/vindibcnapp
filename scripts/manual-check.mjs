/**
 * Comprova el manual del client en els tres idiomes.
 *
 * LA INVARIANT
 *
 * Per a uns mateixos ajustos, els tres idiomes han de produir la MATEIXA
 * ESTRUCTURA: mateix nombre de capítols, mateixos `id` en el mateix ordre,
 * mateixos tipus de bloc en el mateix ordre i el mateix nombre d'elements a
 * cada llista i cada taula. Només ha de canviar el text.
 *
 * Serveix per atrapar l'error típic de traduir: perdre un bloc, duplicar-lo o
 * deixar-se una fila d'una taula. Res d'això el veu el compilador —tots són
 * cadenes vàlides— i a la pantalla només es nota si algú llegeix el manual
 * sencer en els tres idiomes.
 *
 * Es passa amb els mòduls encesos I apagats: la meitat dels blocs del manual
 * només existeixen en una de les dues configuracions, i sense la segona
 * passada no es comprovarien mai.
 *
 * LES ALTRES DUES COMPROVACIONS
 *
 * - Cap cadena buida (una traducció que s'ha quedat a mig esborrar).
 * - Cap cadena idèntica entre català i un altre idioma, que és l'heurística
 *   per trobar el que encara no s'ha traduït. Com que HI HA cadenes que han de
 *   coincidir de debò —un codi, una xifra, un nom propi—, no és un error sinó
 *   un recompte: mentre la traducció està en marxa serveix per saber quant en
 *   queda, i quan acabi ha de baixar fins a les excepcions de sota.
 */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes("--strict");

/* Els ajustos es passen en dues configuracions oposades perquè els blocs
   condicionals surtin tots dos camins. */
const BASE = {
  minCancellationHours: 8,
  minBookingHours: 6,
  openingHour: 7,
  closingHour: 22,
  groupCapacity: 4,
  bonoLowThreshold: 1,
  bonoExpiryMonths: 12,
  pendingPaymentCancelEnabled: false,
  pendingPaymentCancelHours: 48,
  reminderHourLocal: 20,
  bonoExpiryWarningDays: 7,
  minPasswordLength: 8,
  giftVouchersEnabled: true,
  giftVoucherExpiryMonths: 12,
  waitlistEnabled: true,
  subscriptionsEnabled: true,
  subscriptionExtraSessionsMax: 1,
  referralProgramActive: true,
  referralDiscountPercent: 10,
  referralRewardReferee: true,
  modules: { comunitat: true, documents: true, sessionsProva: true },
  cardPayments: true,
  documentsMaxMb: 10,
  trialMinAdvanceHours: 24,
  trialMaxAdvanceDays: 30,
};

const FLIPPED = {
  ...BASE,
  minBookingHours: 0,
  bonoLowThreshold: 3,
  bonoExpiryMonths: null,
  pendingPaymentCancelEnabled: true,
  giftVouchersEnabled: false,
  waitlistEnabled: false,
  subscriptionsEnabled: false,
  subscriptionExtraSessionsMax: 0,
  referralProgramActive: false,
  cardPayments: false,
  modules: { comunitat: false, documents: false, sessionsProva: false },
};

/**
 * Cadenes que poden ser iguals en dos idiomes sense que sigui un descuit.
 * Cada una amb el seu motiu, perquè la llista no creixi sola.
 */
const SAME_ON_PURPOSE = new Set([
  // ca i es s'escriuen igual
  "Sí",
  "Reserva confirmada",
  "Confirmada",
  "Congelada",
  "Idioma",
  "Franja",
  "EP Individual",
  // Nom del producte: no es tradueix en castellà.
  "Regala Vindi",
  // Els tres s'escriuen igual
  "No",
  // ca i en s'escriuen igual
  "Documents",
]);

/** L'esquelet d'un manual: tot el que NO és text. */
function skeleton(chapters) {
  return chapters.map((c) => ({
    id: c.id,
    blocks: c.blocks.map((b) => ({
      t: b.t,
      n: b.items?.length ?? b.rows?.length ?? null,
      cols: b.head?.length ?? null,
      // Als `dl` cada element és un parell; a la taula, una fila.
      inner: (b.items ?? b.rows ?? [])
        .map((x) => (Array.isArray(x) ? x.length : 0))
        .join(","),
    })),
  }));
}

/** Totes les cadenes d'un manual, en ordre. */
function strings(chapters) {
  const out = [];
  for (const c of chapters) {
    out.push(c.title);
    for (const b of c.blocks) {
      if (typeof b.text === "string") out.push(b.text);
      for (const it of b.items ?? []) {
        if (Array.isArray(it)) out.push(...it);
        else out.push(it);
      }
      for (const h of b.head ?? []) out.push(h);
      for (const r of b.rows ?? []) out.push(...r);
    }
  }
  return out;
}

/* El builder és TypeScript: es compila a un fitxer temporal i s'importa. Va a
   la carpeta temporal del sistema i no al repositori: és un artefacte de
   compilació i no ha de poder acabar en cap commit. */
const OUT = join(tmpdir(), `vindibcn-manual-${process.pid}.mjs`);
execFileSync(
  "npx",
  [
    "esbuild",
    "lib/help/client-manual.ts",
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile=${OUT}`,
    "--log-level=error",
  ],
  { stdio: "inherit" },
);
const { buildClientManual } = await import(pathToFileURL(OUT).href);
rmSync(OUT, { force: true });

const LOCALES = ["ca", "es", "en"];
let errors = 0;
let untranslated = 0;
let total = 0;

for (const [name, settings] of [
  ["mòduls encesos", BASE],
  ["mòduls apagats", FLIPPED],
]) {
  const built = Object.fromEntries(
    LOCALES.map((l) => [l, buildClientManual(settings, l)]),
  );

  // 1. Mateixa estructura als tres.
  const ref = JSON.stringify(skeleton(built.ca));
  for (const l of ["es", "en"]) {
    if (JSON.stringify(skeleton(built[l])) !== ref) {
      console.error(`✗ [${name}] l'estructura de ${l} no coincideix amb ca`);
      const a = skeleton(built.ca);
      const b = skeleton(built[l]);
      for (let i = 0; i < Math.max(a.length, b.length); i++)
        if (JSON.stringify(a[i]) !== JSON.stringify(b[i]))
          console.error(
            `   capítol ${i + 1}: ca=${a[i]?.id ?? "—"} · ${l}=${b[i]?.id ?? "—"}`,
          );
      errors++;
    }
  }

  // 2. Cap cadena buida, en cap idioma.
  for (const l of LOCALES)
    strings(built[l]).forEach((s, i) => {
      if (!s || !s.trim()) {
        console.error(`✗ [${name}] cadena buida a ${l}, posició ${i}`);
        errors++;
      }
    });

  // 3. Quant queda per traduir.
  const ca = strings(built.ca);
  for (const l of ["es", "en"]) {
    const other = strings(built[l]);
    ca.forEach((s, i) => {
      total++;
      if (s === other[i] && !SAME_ON_PURPOSE.has(s.trim())) untranslated++;
    });
  }
}

console.log(
  `manual del client · ${LOCALES.length} idiomes · ${total} comparacions`,
);
if (untranslated > 0) {
  const pct = Math.round((untranslated / total) * 100);
  console.log(`  pendents de traduir: ${untranslated} (${pct}%)`);
  if (STRICT) {
    console.error("✗ amb --strict no s'admet cap cadena sense traduir");
    errors++;
  }
} else {
  console.log("  tot traduït");
}

if (errors) {
  console.error(`\n✗ ${errors} problema/es`);
  process.exit(1);
}
console.log("✓ estructura idèntica als tres idiomes");
