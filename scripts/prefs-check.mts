/**
 * Desar les preferències de notificació només toca les caselles del rol de qui
 * desa.
 *
 *   npm run prefs:check
 *
 * Abans, `updateNotificationPreferencesAction` recorria totes les
 * `PREFERENCE_KEYS` i una casella que el formulari no pinta arribava absent, és
 * a dir `false`: un client que desava apagava els avisos de professional i
 * d'admin de la seva fila. Es va veure a producció el 14/10/2026 amb el Client
 * Demo (`trainer_booking_received_email`, `trainer_booking_cancelled_email` i
 * `new_client_registered_email` de `true` a `false`).
 *
 * Prova l'ACCIÓ real (getViewer → profiles → upsert) contra el Supabase de
 * memòria, per als tres rols: no toca cap base. Per a cadascun:
 *
 *   · es desmarca tot el que veu i es torna a marcar la meitat → la base diu
 *     exactament això a les seves caselles;
 *   · les caselles dels altres rols es queden com eren (`true`);
 *   · el formulari i l'acció fan servir la mateixa llista;
 *   · cap columna desada queda òrfena (sense cap rol que la pugui canviar),
 *     tret de les dels avisos que són fora de la UI a posta.
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

const { USE_MOCK } = await import("../lib/config");
const { updateNotificationPreferencesAction } = await import(
  "../lib/actions/notification-preferences"
);
const { PREFERENCE_KEYS, editableEvents, editablePreferenceKeys, prefKey } =
  await import("../lib/notifications/preferences-defaults");
const { EVENT_META } = await import("../lib/notifications/types");

let fallides = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallides++;
};

type Role = "client" | "trainer" | "admin";
const ROLES: Role[] = ["client", "trainer", "admin"];

check(!USE_MOCK, "branca real (no la simulació)");

for (const role of ROLES) {
  console.log(`\n${role}`);
  const id = `p-${role}`;
  const allTrue = Object.fromEntries(PREFERENCE_KEYS.map((k) => [k, true]));
  fake.tables = {
    profiles: [{ id, role, full_name: role, specialty: null }],
    notification_preferences: [{ id: `np-${role}`, profile_id: id, ...allTrue }],
  };
  fake.writes = [];
  (globalThis as { __fakeUser?: unknown }).__fakeUser = { id, email: `${role}@x.test` };

  const mine = editablePreferenceKeys(role);
  const others = PREFERENCE_KEYS.filter((k) => !mine.includes(k));
  // Marcades: una sí, una no. Les altres arriben absents, com al navegador.
  const marked = new Set(mine.filter((_, i) => i % 2 === 0));
  const fd = new FormData();
  for (const k of marked) fd.set(k, "on");

  const res = await updateNotificationPreferencesAction({}, fd);
  const row = fake.tables.notification_preferences[0];

  check(res.ok === true && !res.error, "desa sense error");
  check(mine.length > 0, `veu ${mine.length} caselles`);
  check(
    mine.every((k) => row[k] === marked.has(k)),
    "les seves caselles queden com les ha deixat",
  );
  check(
    others.every((k) => row[k] === true),
    `les ${others.length} dels altres rols no es toquen`,
  );
  check(
    fake.writes.length === 1 && fake.writes[0].table === "notification_preferences",
    "una sola escriptura, a notification_preferences",
  );
  check(
    editableEvents(role).map((t) => prefKey(t, "email")).join() === mine.join(),
    "el formulari i l'acció fan servir la mateixa llista",
  );
}

console.log("\nCobertura");
const reachable = new Set(ROLES.flatMap((r) => editablePreferenceKeys(r)));
// Una columna sense cap rol que la pugui canviar només és vàlida si l'avís és
// fora de la UI A POSTA (`audience: []`, com `new_exercises_assigned`, que
// l'envia l'equip a mà sense mirar preferències). Qualsevol altra seria una
// casella que algú hauria de veure i no veu.
const orphans = PREFERENCE_KEYS.filter((k) => !reachable.has(k));
const unexpected = orphans.filter(
  (k) => EVENT_META[k.replace(/_email$/, "") as keyof typeof EVENT_META].audience.length > 0,
);
check(
  unexpected.length === 0,
  `cap columna òrfena sense voler${unexpected.length ? `: ${unexpected.join(", ")}` : ""}` +
    (orphans.length ? ` (fora de la UI a posta: ${orphans.join(", ")})` : ""),
);

console.log("\nSense sessió");
(globalThis as { __fakeUser?: unknown }).__fakeUser = null;
fake.writes = [];
const anon = await updateNotificationPreferencesAction({}, new FormData());
check(anon.error === true && fake.writes.length === 0, "error i cap escriptura");

console.log(fallides ? `\n${fallides} comprovacions fallides` : "\nTot correcte");
process.exit(fallides ? 1 : 0);
