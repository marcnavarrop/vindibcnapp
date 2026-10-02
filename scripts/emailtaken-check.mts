/**
 * Donar d'alta algú amb un correu que ja té compte: s'atura ABANS de crear res,
 * amb un missatge en català.
 *
 *   npm run emailtaken:check
 *
 * Prova la branca REAL (`createClientRecord`, `createTrainer`,
 * `findAccountByEmail`) contra el Supabase de memòria: no toca cap base. Els
 * casos:
 *
 *   · el correu d'un client, escrit amb majúscules i espais → error amb el seu
 *     nom i la seva fitxa, i cap escriptura a la base ni crida a Auth;
 *   · el d'un professional → error, tant donant d'alta un client com un
 *     professional;
 *   · els comodins d'`ilike`: «ana_p@…» no és «anaxp@…», ni «a%b@…» és «axxb@…»;
 *   · un correu lliure passa;
 *   · si algú l'ocupa just entremig, l'error d'Auth (en anglès) arriba en català.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
delete process.env.NEXT_PUBLIC_USE_MOCK;

type Row = Record<string, unknown>;
const fake = {
  tables: {} as Record<string, Row[]>,
  hooks: {},
  writes: [] as { table: string; op: string; via: string }[],
};
(globalThis as { __fakeDb?: unknown }).__fakeDb = fake;
let authCalls = 0;
let authResult: unknown = null;
(globalThis as { __fakeGenerateLink?: unknown }).__fakeGenerateLink = () => {
  authCalls++;
  return authResult;
};

const { USE_MOCK } = await import("../lib/config");
const { findAccountByEmail, EmailTakenError } = await import("../lib/data/account-email");
const { createClientRecord } = await import("../lib/data/clients");
const { createTrainer } = await import("../lib/data/trainers");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};
const reset = () => {
  fake.tables = {
    profiles: [
      { id: "p-ana", email: "ana.ferrer@example.com", role: "client", full_name: "Ana Ferrer" },
      { id: "p-laia", email: "laia@vindi.test", role: "trainer", full_name: "Laia Puig" },
      { id: "p-x", email: "anaxp@example.com", role: "client", full_name: "Anna X" },
      { id: "p-u", email: "ana_p@example.com", role: "client", full_name: "Ana P" },
      { id: "p-y", email: "axxb@example.com", role: "client", full_name: "Abc" },
    ],
    clients: [
      { id: "c-ana", profile_id: "p-ana" },
      { id: "c-x", profile_id: "p-x" },
      { id: "c-u", profile_id: "p-u" },
      { id: "c-y", profile_id: "p-y" },
    ],
  };
  fake.writes = [];
  authCalls = 0;
  authResult = null;
};
const client = (email: string) => ({ fullName: "Algú Nou", email, phone: null, assignedTrainerId: null, clinicalNotes: null, generalNotes: null });
const tryCreate = async (f: () => Promise<unknown>) => {
  try { await f(); return null; } catch (e) { return e; }
};

console.log(`\nBranca real (USE_MOCK = ${USE_MOCK})`);
check(!USE_MOCK, "es prova la branca de Supabase, no la de la simulació");

console.log("\nEl correu ja és d'un client");
reset();
{
  const e = await tryCreate(() => createClientRecord(client("  Ana.Ferrer@Example.COM ")));
  check(e instanceof EmailTakenError, "majúscules i espais: és el mateix correu");
  check(e instanceof Error && e.message === "Ja hi ha un client amb aquest correu: Ana Ferrer. No s'ha creat res.", `missatge: «${e instanceof Error ? e.message : e}»`);
  check(e instanceof EmailTakenError && e.existingClientId === "c-ana", "porta la fitxa del client per enllaçar-hi");
  check(fake.writes.length === 0 && authCalls === 0, `abans de crear res: ${fake.writes.length} escriptures, ${authCalls} crides a Auth`);
}

console.log("\nEl correu ja és d'un professional");
reset();
{
  const e = await tryCreate(() => createClientRecord(client("laia@vindi.test")));
  check(e instanceof EmailTakenError && e.message === "Aquest correu ja és d'un professional del centre (Laia Puig). No s'ha creat res: cada compte necessita un correu propi." && e.existingClientId === null,
    `alta de client: «${e instanceof Error ? e.message : e}»`);
  const e2 = await tryCreate(() => createTrainer({ fullName: "Algú", email: "LAIA@vindi.test", specialty: "entrenador" } as never));
  check(e2 instanceof EmailTakenError && fake.writes.length === 0 && authCalls === 0, "alta de professional: també s'atura, sense escriure res");
}

console.log("\nEls comodins d'ilike no compten");
reset();
check((await findAccountByEmail("ANA_P@example.com"))?.profileId === "p-u", "«ANA_P@…» troba «ana_p@…» (el «_» de debò)");
fake.tables.profiles = fake.tables.profiles.filter((p) => p.id !== "p-u");
check((await findAccountByEmail("ana_p@example.com")) === null, "«ana_p@…» no és «anaxp@…»");
check((await findAccountByEmail("a%b@example.com")) === null, "«a%b@…» no és «axxb@…»");
check((await findAccountByEmail("nou@example.com")) === null, "un correu lliure no troba ningú");
check((await findAccountByEmail("   ")) === null, "un correu buit no troba ningú");

console.log("\nAlgú l'ocupa just entremig");
reset();
authResult = { data: null, error: { code: "email_exists", message: "A user with this email address has already been registered" } };
{
  const e = await tryCreate(() => createClientRecord(client("nou@example.com")));
  check(authCalls === 1 && e instanceof Error && e.message === "Ja hi ha un compte amb aquest correu. No s'ha creat res.", `l'error d'Auth arriba en català: «${e instanceof Error ? e.message : e}»`);
  check(!fake.writes.some((w) => w.table === "clients"), "i no es crea cap fila de client");
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
