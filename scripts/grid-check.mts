/**
 * Comprova la geometria de la rejilla del professional (lib/trainer-grid-layout.ts).
 *
 *   npm run grid:check
 *
 * Quins dies i quines hores surten, on cau cada instant i com es reparteixen
 * l'amplada les sessions que coincideixen. Són les decisions que, si es
 * trenquen, no les veu el compilador: la rejilla segueix pintant, però mal.
 */
import {
  FOLD_PX,
  SLOT_PX,
  placeByDensity,
  verticalLayout,
  visibleDays,
} from "../lib/trainer-grid-layout";

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

console.log("\nDies");
{
  const week = [0, 1, 2, 3, 4, 5, 6];
  const full = new Set([5]);
  check(
    JSON.stringify(visibleDays(week, (d) => d, (d) => full.has(d), false)) === "[0,1,2,3,4,5]",
    "dissabte amb alguna cosa surt; diumenge buit, no",
  );
  check(
    JSON.stringify(visibleDays(week, (d) => d, () => false, false)) === "[0,1,2,3,4]",
    "un feiner buit segueix sortint",
  );
  check(visibleDays(week, (d) => d, () => false, true).length === 7, "«Mostrar-ho tot»: els set");
}

console.log("\nHores");
{
  // Matí 9–13 i tarda 17–20 (slots 18–26 i 34–40): el buit de 13 a 17 es plega.
  const active = new Set([...range(18, 26), ...range(34, 40)]);
  const v = verticalLayout(active, 14, 44, false);
  check(v.from === 18 && v.to === 40, "del primer al darrer slot actiu (9:00–20:00)");
  check(
    v.segments.map((g) => g.kind).join(",") === "hours,fold,hours",
    `9–13 hores, 13–17 plegat, 17–20 hores (${v.segments.map((g) => `${g.kind}:${g.from}-${g.to}`).join(" ")})`,
  );
  check(v.height === 8 * SLOT_PX + FOLD_PX + 6 * SLOT_PX, `alçada ${v.height} px`);
  check(v.y(18) === 0 && v.y(20) === 2 * SLOT_PX, "les 10:00 cauen a 80 px (60 min = 80 px)");
  check(v.y(34) === 8 * SLOT_PX + FOLD_PX, "les 17:00 cauen just sota la banda plegada");
  check(v.y(30) > v.y(26) && v.y(30) < v.y(34), "un instant dins del plec cau dins de la banda");

  // Un buit d'una hora (12–13) NO es plega.
  const short = new Set([...range(18, 24), ...range(26, 30)]);
  check(
    verticalLayout(short, 14, 44, false).segments.every((g) => g.kind === "hours"),
    "un buit d'una hora es queda a la vista",
  );
  // Comença a les 9:30 → la rejilla arrenca a les 9:00.
  check(verticalLayout(new Set([19, 20]), 14, 44, false).from === 18, "arrenca en hora en punt");
  const all = verticalLayout(active, 14, 44, true);
  check(
    all.from === 14 && all.to === 44 && all.segments.length === 1,
    "«Mostrar-ho tot»: l'horari del centre sencer, sense plegar",
  );
  check(verticalLayout(new Set(), 14, 44, false).from === 14, "sense res, l'horari del centre");
}

console.log("\nDensitat");
{
  const H = 3_600_000;
  const it = (id: string, h: number, own = false, len = 1) => ({ id, start: h * H, end: (h + len) * H, own });
  const one = placeByDensity([it("a", 9)]);
  check(one.length === 1 && one[0].kind === "item" && one[0].level === 1, "una sola: nivell 1, tota l'amplada");
  const seguides = placeByDensity([it("a", 9), it("b", 10)]);
  check(seguides.every((p) => p.kind === "item" && p.level === 1), "seguides (9 i 10) no es trepitgen");
  const two = placeByDensity([it("a", 9, true), it("b", 9.5)]);
  check(
    two.length === 2 && two.every((p) => p.kind === "item" && p.level === 2 && p.lanes === 2),
    "dues que es trepitgen: nivell 2, meitat i meitat",
  );
  const three = placeByDensity([it("mine", 9, true), it("c1", 9), it("c2", 9.5), it("t", 9)]);
  const mine = three.find((p) => p.kind === "item");
  const more = three.find((p) => p.kind === "more");
  check(
    three.length === 2 && mine?.kind === "item" && mine.id === "mine" && mine.level === 3,
    "tres o més: la pròpia es queda visible",
  );
  check(more?.kind === "more" && more.ids.length === 3, "…i la resta s'agrupa en «+3»");
  const noOwn = placeByDensity([it("c1", 9), it("c2", 9), it("c3", 9)]);
  check(noOwn.length === 1 && noOwn[0].kind === "more" && noOwn[0].lanes === 1, "sense pròpia: tot en «+3», tota l'amplada");
}

console.log(fallides ? `\n✗ ${fallides} fallides` : "\n✓ Tot correcte");
process.exit(fallides ? 1 : 0);
