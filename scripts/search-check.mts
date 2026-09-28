/**
 * Comprova com el buscador de clients compara el que s'escriu amb els noms
 * (lib/client-search-match.ts).
 *
 *   npm run search:check
 *
 * A la simulació la comparació es fa en JavaScript (`matchesName`); a la base
 * real, amb una expressió regular per paraula (`wordRegex`) que Postgres aplica
 * amb `imatch` (~*, sense majúscules). Aquí es comprova que les dues diguin el
 * mateix per als casos que importen: accents, majúscules, ordre, ç i ñ, i que
 * cap caràcter de qui escriu es converteixi en un comodí.
 */
import { foldName, matchesName, nameWords, wordRegex } from "../lib/client-search-match";

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
/** Com ho faria Postgres: totes les paraules, cadascuna en qualsevol lloc, sense majúscules. */
const pg = (name: string, q: string) => nameWords(q).every((w) => new RegExp(wordRegex(w), "i").test(name));

const NAMES = ["ÀNGELS VIDAL", "Núria Serra", "Nuria Sala", "Laia Puig", "Jaume Puig", "Irene Martí", "Joan Garçon", "Íñigo Muñoz", "Anna Roig", "Marc.Riera (test)"];
const CASES: [string, string[]][] = [
  ["nuria", ["Núria Serra", "Nuria Sala"]],
  ["NÚRIA", ["Núria Serra", "Nuria Sala"]],
  ["serra nu", ["Núria Serra"]],
  ["puig laia", ["Laia Puig"]],
  ["puig", ["Laia Puig", "Jaume Puig"]],
  ["marti", ["Irene Martí"]],
  ["garcon", ["Joan Garçon"]],
  ["inigo munoz", ["Íñigo Muñoz"]],
  ["muñoz", ["Íñigo Muñoz"]],
  ["m.r", []],
  ["riera (", ["Marc.Riera (test)"]],
  ["a.*", []],
  ["zzz", []],
  ["angels", ["ÀNGELS VIDAL"]],
];

console.log("\nSimulació i base real diuen el mateix");
for (const [q, want] of CASES) {
  const js = NAMES.filter((n) => matchesName(n, q));
  const db = NAMES.filter((n) => pg(n, q));
  check(JSON.stringify(js) === JSON.stringify(want) && JSON.stringify(db) === JSON.stringify(want), `«${q}» → ${JSON.stringify(want)}${JSON.stringify(js) !== JSON.stringify(want) ? ` (simulació: ${JSON.stringify(js)})` : ""}${JSON.stringify(db) !== JSON.stringify(want) ? ` (base: ${JSON.stringify(db)})` : ""}`);
}

console.log("\nPeces");
check(foldName("Àngels ÇÑ") === "angels cn", "foldName treu accents i majúscules");
check(wordRegex("nuria") === "[nñÑ][uùúûüÙÚÛÜ]r[iìíîïÌÍÎÏ][aàáâäãÀÁÂÄÃ]", "wordRegex obre les vocals, la c i la n, amb les majúscules");
check(wordRegex("a.b") === "[aàáâäãÀÁÂÄÃ]\\.b", "wordRegex escapa el punt");
// Sense la bandera «i»: una inicial accentuada en majúscula ha de casar igualment
// (les ASCII les iguala `imatch` sempre).
check(new RegExp(wordRegex("inigo")).test("Íñigo") && new RegExp(wordRegex("angels")).test("Àngels"), "una majúscula accentuada casa sense dependre del «locale»");
check(nameWords("  laia   puig ").length === 2, "les paraules, sense espais sobrants");

console.log(fallides ? `\n✗ ${fallides} fallades` : "\n✓ El buscador troba el mateix a la simulació i a la base.");
process.exit(fallides ? 1 : 0);
