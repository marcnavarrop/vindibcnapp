/**
 * Cobrar un bo: o s'activa EXACTAMENT un bo i s'anota el pagament, o falla amb
 * un motiu clar i no s'anota res.
 *
 *   npm run paid:check
 *
 * Prova la branca REAL de `markBonoPaid` (la de Supabase, no la de la
 * simulació) contra un Supabase de memòria (`scripts/shims/fake-supabase.ts`):
 * no toca cap base. Els casos:
 *
 *   · l'admin (efectiu) i el webhook de Stripe (targeta) cobren com sempre;
 *   · el professional també: la seva RLS (`bonos_trainer_collect_any`)
 *     li deixa cobrar un bo cobrable de qualsevol client;
 *   · un bo ja cobrat o inexistent → error, cap pagament;
 *   · dos cobraments alhora: el bo es llegeix pendent però, quan s'actualitza,
 *     algú altre ja l'ha cobrat → 0 files → error, cap pagament (abans
 *     s'anotava un segon pagament);
 *   · la RLS no deixa actualitzar → 0 files → error, cap pagament;
 *   · el mètode del taulell: efectiu o targeta del TPV, tots dos amb la sessió
 *     (passen per la RLS); només el de Stripe va per la clau de servei;
 *   · cobrar un val de regal: el mateix tot o res (abans, dos cobraments alhora
 *     n'anotaven dos) i amb el mètode triat;
 *   · un mètode que no és ni efectiu ni targeta no s'accepta.
 *
 * Les accions (`markBonoPaidAction`, `markTrainerBonoPaidAction`) amb el seu
 * missatge a la pantalla es proven a part, en simulació i amb Playwright.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
delete process.env.NEXT_PUBLIC_USE_MOCK;

type Row = Record<string, unknown>;
const fake = {
  tables: {} as Record<string, Row[]>,
  hooks: {} as { beforeUpdate?: (t: string, rows: Row[]) => void; canUpdate?: (t: string, r: Row) => boolean },
  writes: [] as { table: string; op: string; via: string }[],
};
(globalThis as { __fakeDb?: unknown }).__fakeDb = fake;

const { USE_MOCK } = await import("../lib/config");
const { markBonoPaid } = await import("../lib/data/bonos");
const { markGiftVoucherPaid } = await import("../lib/data/gift-vouchers");
const { parseCounterMethod } = await import("../lib/counter-payment");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

const bono = (id: string, status: string): Row => ({
  id, client_id: "c-1", price: 120, status, service_type: "ep_individual", total_sessions: 10, remaining_sessions: 10,
});
const reset = (...bonos: Row[]) => {
  fake.tables = { bonos, payments: [], clients: [{ id: "c-1", referred_by: null }], referral_rewards: [], subscriptions: [] };
  fake.hooks = {};
  fake.writes = [];
};
const pays = () => fake.tables.payments ?? [];
const status = (id: string) => fake.tables.bonos.find((b) => b.id === id)?.status;
const attempt = async (id: string, payment?: Parameters<typeof markBonoPaid>[1]) => {
  try {
    await markBonoPaid(id, payment);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

console.log(`\nBranca real (USE_MOCK = ${USE_MOCK})`);
check(!USE_MOCK, "es prova la branca de Supabase, no la de la simulació");

console.log("\nCobra com sempre");
for (const st of ["pending_payment", "unpaid"]) {
  reset(bono("b1", st));
  const e = await attempt("b1");
  check(!e && status("b1") === "active" && pays().length === 1 && pays()[0].amount === 120 && pays()[0].method === "cash",
    `admin/professional, bo ${st}: actiu i 1 pagament de 120 € en efectiu${e ? ` (${e})` : ""}`);
}
reset(bono("b1", "pending_payment"));
{
  const e = await attempt("b1", { method: "card", stripePaymentId: "pi_1", stripeCheckoutSessionId: "cs_1" });
  check(!e && status("b1") === "active" && pays().length === 1 && pays()[0].method === "card" && fake.tables.bonos[0].stripe_checkout_session_id === "cs_1",
    "Stripe (targeta): actiu, 1 pagament amb targeta i la sessió desada al bo");
}
// El professional cobra un bo d'un client que no és seu: la seva RLS ho permet
// mentre el bo sigui cobrable (bonos_trainer_collect_any).
reset(bono("b1", "pending_payment"));
fake.hooks.canUpdate = (t, r) => t !== "bonos" || ["pending_payment", "unpaid"].includes(String(r.status));
{
  const e = await attempt("b1");
  check(!e && status("b1") === "active" && pays().length === 1, "professional, amb la RLS de cobrar: actiu i 1 pagament");
}

console.log("\nFalla amb un motiu clar i no anota res");
reset(bono("b1", "active"));
{
  const e = await attempt("b1");
  check(e === "Aquest bo ja està cobrat o ja no es pot cobrar. No s'ha anotat cap pagament." && pays().length === 0, `ja cobrat: «${e}»`);
}
reset(bono("b1", "pending_payment"));
{
  const e = await attempt("no-existeix");
  check(e === "No s'ha trobat aquest bo. No s'ha anotat cap pagament." && pays().length === 0, `inexistent: «${e}»`);
}
reset(bono("b1", "pending_payment"));
fake.hooks.beforeUpdate = (t, rows) => { if (t === "bonos") rows[0].status = "active"; };
{
  const e = await attempt("b1");
  check(!!e && pays().length === 0, `cobrament simultani (el llegeix pendent, però ja està cobrat en actualitzar): «${e}», 0 pagaments`);
}
reset(bono("b1", "pending_payment"));
fake.hooks.canUpdate = () => false;
{
  const e = await attempt("b1");
  check(!!e && status("b1") === "pending_payment" && pays().length === 0, `la RLS no deixa actualitzar: «${e}», el bo segueix pendent i 0 pagaments`);
}
reset(bono("b1", "pending_payment"));
{
  await attempt("b1", { method: "card", stripePaymentId: "pi_1", stripeCheckoutSessionId: "cs_1" });
  const e = await attempt("b1", { method: "card", stripePaymentId: "pi_1", stripeCheckoutSessionId: "cs_1" });
  check(!!e && pays().length === 1, "webhook de Stripe repetit: el segon llança (el webhook ho tracta com a duplicat) i segueix havent-hi 1 pagament");
}

console.log("\nEl mètode del taulell");
const payVia = () => fake.writes.filter((w) => w.table === "payments" && w.op === "insert").map((w) => w.via);
reset(bono("b1", "pending_payment"));
{
  const e = await attempt("b1", { method: "card" });
  const p = pays()[0];
  check(!e && status("b1") === "active" && pays().length === 1 && p.method === "card" && !p.stripe_payment_id,
    `targeta del TPV: actiu i 1 pagament amb targeta sense identificador de Stripe${e ? ` (${e})` : ""}`);
  check(payVia().join() === "session", `targeta del TPV: l'anota la sessió (RLS), no la clau de servei (${payVia().join()})`);
}
reset(bono("b1", "pending_payment"));
{
  await attempt("b1", { method: "cash" });
  check(pays()[0]?.method === "cash" && payVia().join() === "session", "efectiu: amb la sessió, com sempre");
}
reset(bono("b1", "pending_payment"));
{
  await attempt("b1", { method: "card", stripePaymentId: "pi_2", stripeCheckoutSessionId: "cs_2" });
  check(payVia().join() === "admin", `Stripe: l'anota la clau de servei (${payVia().join()})`);
}
check(parseCounterMethod(null) === "cash" && parseCounterMethod("") === "cash", "sense camp de mètode (una pestanya d'abans): efectiu");
check(parseCounterMethod("cash") === "cash" && parseCounterMethod("card") === "card", "«cash» i «card» s'accepten tal qual");
check(parseCounterMethod("bizum") === null && parseCounterMethod("CARD") === null, "qualsevol altra cosa: no es cobra (l'acció torna l'error)");

console.log("\nCobrar un val de regal");
const val = (status: string): Row => ({ id: "v1", status, price: 190, buyer_client_id: "c-1", service_type: "ep_individual", total_sessions: 4, code: "VINDI-AAAA-BBBB" });
const resetVal = (status: string) => {
  fake.tables = { gift_vouchers: [val(status)], payments: [] };
  fake.hooks = {};
  fake.writes = [];
};
const valStatus = () => fake.tables.gift_vouchers[0].status;
const attemptVal = async (m?: "cash" | "card") => {
  try { await markGiftVoucherPaid("v1", m); return null; } catch (e) { return e instanceof Error ? e.message : String(e); }
};
resetVal("pending_payment");
{
  const e = await attemptVal("card");
  check(!e && valStatus() === "active" && pays().length === 1 && pays()[0].method === "card" && pays()[0].amount === 190,
    `targeta del TPV: actiu i 1 pagament de 190 € amb targeta${e ? ` (${e})` : ""}`);
}
resetVal("pending_payment");
{
  const e = await attemptVal();
  check(!e && pays().length === 1 && pays()[0].method === "cash", "sense mètode: efectiu, com abans");
}
resetVal("pending_payment");
fake.hooks.beforeUpdate = (t, rows) => { if (t === "gift_vouchers") rows[0].status = "active"; };
{
  const e = await attemptVal("cash");
  check(!!e && pays().length === 0, `cobrament simultani del val: «${e}», 0 pagaments (abans n'anotava un altre)`);
}
resetVal("active");
{
  const e = await attemptVal("cash");
  check(e === "Aquest val ja està cobrat o ja no es pot cobrar. No s'ha anotat cap pagament." && pays().length === 0, `val ja cobrat: «${e}»`);
}

console.log(fallides === 0 ? "\nTot correcte.\n" : `\n${fallides} comprovacions han fallat.\n`);
process.exit(fallides === 0 ? 0 : 1);
