import { periodFor, recentPeriods } from "@/lib/data/bonus";

console.log(`TZ del procés: ${Intl.DateTimeFormat().resolvedOptions().timeZone} (com Vercel)\n`);
const casos: [string, string, string][] = [
  ["2025-12-31T22:30:00Z", "31 des 2025, 23:30 Madrid", "Any 2025"],
  ["2025-12-31T23:30:00Z", " 1 gen 2026, 00:30 Madrid", "Any 2026"],  // ← el cas crític
  ["2026-01-01T00:30:00Z", " 1 gen 2026, 01:30 Madrid", "Any 2026"],
  ["2026-06-15T10:00:00Z", "15 jun 2026, 12:00 Madrid", "Any 2026"],
  ["2026-12-31T23:30:00Z", " 1 gen 2027, 00:30 Madrid", "Any 2027"],
];
console.log("ANUAL");
for (const [iso, etiqueta, esperat] of casos) {
  const p = periodFor("annual", new Date(iso));
  console.log(`${p.label===esperat?"✓":"✗"} ${etiqueta} → ${p.label.padEnd(9)} (${p.start} → ${p.end})  esperat ${esperat}`);
}
console.log("\nBIENNAL (parelles fixes que arrenquen en any senar)");
for (const [iso, etiqueta, any] of casos) {
  const p = periodFor("biennial", new Date(iso));
  console.log(`  ${etiqueta} → ${p.label} (${p.start} → ${p.end})`);
}
console.log("\nrecentPeriods just després de mitjanit de l'1 de gener de 2026 (00:30 Madrid):");
for (const p of recentPeriods("annual", 4, new Date("2025-12-31T23:30:00Z"))) console.log("   ", p.label);
console.log("\nrecentPeriods biennal al mateix instant:");
for (const p of recentPeriods("biennial", 3, new Date("2025-12-31T23:30:00Z"))) console.log("   ", p.label);
