/**
 * Els errors d'Auth arriben a l'admin en català, mai en anglès.
 *
 *   npm run autherrors:check
 */
import { authErrorCa, authErrorKey, loginUrlError } from "../lib/auth-errors";

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

// Login, registre i nova contrasenya: una clau per traduir, mai l'anglès.
console.log("\nClaus per a les pantalles d'accés (ca/es/en):");
const keyCases: [Parameters<typeof authErrorKey>[0], ReturnType<typeof authErrorKey>][] = [
  [{ code: "invalid_credentials", message: "Invalid login credentials" }, "invalidCredentials"],
  [{ message: "Invalid login credentials" }, "invalidCredentials"],
  [{ code: "email_not_confirmed", message: "Email not confirmed" }, "emailNotConfirmed"],
  [{ message: "User already registered" }, "emailExists"],
  [{ code: "weak_password", message: "Password should be at least 8 characters." }, "weakPassword"],
  [{ message: "New password should be different from the old password." }, "samePassword"],
  [{ code: "over_request_rate_limit", message: "Request rate limit reached" }, "rateLimited"],
  [{ message: "Email rate limit exceeded" }, "emailRateLimited"],
  [{ message: "Signups not allowed for this instance" }, "signupDisabled"],
];
for (const [e, want] of keyCases) { const k = authErrorKey(e); ok(k === want, `«${e?.message}» → ${k}`); }
console.error = () => {};
ok(authErrorKey({ message: "Something brand new" }) === null, "desconegut → null (missatge genèric de la pantalla)");
console.error = origErr;
ok(authErrorKey(null) === null, "sense error → null");
// L'avís de l'adreça: només codis coneguts; cap text arbitrari arriba a la pantalla.
ok(loginUrlError("link") === "link" && loginUrlError("preExpired") === "preExpired", "?error=link i preExpired → codi");
ok(loginUrlError("El teu compte està bloquejat, truca al 600 000 000") === null, "?error=<text qualsevol> → no es pinta");
ok(loginUrlError(null) === null, "sense ?error= → res");
console.log(bad ? `\n${bad} FALLADES` : "\nTot correcte.");
process.exit(bad ? 1 : 0);
