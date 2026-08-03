import { centerDateStr, centerToday } from "@/lib/center-time";
// centerToday() és exactament centerDateStr(new Date()): provant la primitiva
// amb instants injectats es cobreix la finestra que no es pot reproduir a mà.
console.log(`TZ del procés: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
console.log(`centerToday() ara mateix: ${centerToday()}  (dia UTC: ${new Date().toISOString().slice(0,10)})\n`);
const casos: [string,string][] = [
  ["2026-08-02T21:59:00Z", "2026-08-02"], // 23:59 Madrid, estiu
  ["2026-08-02T22:00:00Z", "2026-08-03"], // 00:00 Madrid → ja és dia nou
  ["2026-08-02T23:30:00Z", "2026-08-03"], // 01:30 Madrid ← la finestra del bug
  ["2026-01-14T23:30:00Z", "2026-01-15"], // 00:30 Madrid, hivern (UTC+1)
  ["2026-01-14T22:30:00Z", "2026-01-14"], // 23:30 Madrid, hivern
];
for (const [iso, esperat] of casos) {
  const got = centerDateStr(new Date(iso));
  const antic = iso.slice(0,10);
  console.log(`${got===esperat?"✓":"✗"} ${iso} → ara ${got} | abans ${antic}${antic!==esperat?"  ← el vell fallava":""}`);
}
