/**
 * Els errors d'Auth arriben a l'admin en català, mai en anglès.
 *
 *   npm run autherrors:check
 */
import { authErrorCa } from "../lib/auth-errors";

let bad = 0;
const ok = (c: boolean, m: string) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) bad++; };
const F = "FALLBACK";
const cases: [Parameters<typeof authErrorCa>[0], RegExp][] = [
  [{ message: "User with this email not found" }, /^No hi ha cap compte d'accés/],
  [{ message: "User not found", code: "user_not_found", status: 404 }, /^No hi ha cap compte d'accés/],
  [{ message: "A user with this email address has already been registered" }, /^Ja hi ha un compte/],
  [{ message: "Email rate limit exceeded", code: "over_email_send_rate_limit" }, /massa correus/],
  [{ message: "For security purposes, you can only request this after 37 seconds." }, /Massa peticions/],
  [{ message: "Unable to validate email address: invalid format" }, /format vàlid/],
  [{ message: "Database error deleting user" }, /ha fallat/],
  [{ code: "request_timeout", message: "timeout" }, /trigat massa/],
];
for (const [e, re] of cases) { const t = authErrorCa(e, F); ok(re.test(t), `«${e?.message}» → «${t}»`); }
const origErr = console.error; let logged = ""; console.error = (m: string) => { logged = m; };
ok(authErrorCa({ message: "Something brand new" }, F) === F && /Something brand new/.test(logged), "desconegut → fallback, i l'original al registre");
console.error = origErr;
ok(authErrorCa(null, F) === F, "sense error → fallback");
console.log(bad ? `\n${bad} FALLADES` : "\nTot correcte.");
process.exit(bad ? 1 : 0);
