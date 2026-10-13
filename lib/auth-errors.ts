/**
 * ELS ERRORS D'AUTH, EN CATALÀ
 *
 * GoTrue (Supabase Auth) respon en anglès —«User with this email not found»,
 * «Email rate limit exceeded»…— i fins ara aquest text arribava tal qual a les
 * pantalles de l'admin (Reenviar invitació, alta, eliminar un client). Aquí es
 * tradueix pel `code` quan n'hi ha i, si no, pel text, que és el que tenen les
 * versions antigues de GoTrue i el mode simulació.
 *
 * El que no es reconeix NO es mostra en anglès: surt `fallback` i l'original
 * va al registre del servidor, que és on es pot investigar.
 */
type AuthLikeError = { message?: string; code?: string; status?: number } | null | undefined;

const BY_CODE: Record<string, string> = {
  user_not_found: "No hi ha cap compte d'accés amb aquest correu.",
  email_exists: "Ja hi ha un compte amb aquest correu.",
  user_already_exists: "Ja hi ha un compte amb aquest correu.",
  email_address_invalid: "El correu no té un format vàlid.",
  validation_failed: "El correu no té un format vàlid.",
  over_email_send_rate_limit: "S'han enviat massa correus en poca estona. Torna-ho a provar d'aquí a uns minuts.",
  over_request_rate_limit: "Massa peticions en poca estona. Torna-ho a provar d'aquí a uns minuts.",
  email_address_not_authorized: "El servei de correu no deixa enviar a aquesta adreça.",
  request_timeout: "El servei d'accés ha trigat massa a respondre. Torna-ho a provar.",
  unexpected_failure: "El servei d'accés ha fallat. Torna-ho a provar d'aquí a una estona.",
};

const BY_TEXT: [RegExp, string][] = [
  [/user (with this email )?not found|no user found/i, BY_CODE.user_not_found],
  [/already (been )?registered|already exists/i, BY_CODE.email_exists],
  [/invalid format|unable to validate email|invalid email/i, BY_CODE.email_address_invalid],
  [/email rate limit|over_email_send_rate_limit/i, BY_CODE.over_email_send_rate_limit],
  [/rate limit|too many requests|only request this after/i, BY_CODE.over_request_rate_limit],
  [/not authorized/i, BY_CODE.email_address_not_authorized],
  [/timeout|timed out/i, BY_CODE.request_timeout],
  [/database error/i, BY_CODE.unexpected_failure],
];

export function authErrorCa(error: AuthLikeError, fallback: string): string {
  if (!error) return fallback;
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  const msg = error.message ?? "";
  for (const [re, ca] of BY_TEXT) if (re.test(msg)) return ca;
  console.error(`[auth] error sense traduir (${error.code ?? error.status ?? "?"}): ${msg}`);
  return fallback;
}

/**
 * ELS ERRORS D'AUTH, EN L'IDIOMA DE QUI ENTRA
 *
 * El login, el registre i la nova contrasenya ensenyaven `error.message` tal
 * com arriba de GoTrue: «Invalid login credentials», en anglès, també a qui
 * llegeix la pantalla en català o castellà. Aquí no es tradueix (això ho fa la
 * pantalla, que sap l'idioma): es diu QUIN error és, amb una clau del
 * namespace `authErrors`. El que no es reconeix torna `null` i la pantalla hi
 * posa el seu missatge genèric; l'original va a la consola.
 */
export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "emailExists"
  | "emailInvalid"
  | "weakPassword"
  | "samePassword"
  | "rateLimited"
  | "emailRateLimited"
  | "timeout"
  | "signupDisabled";

const KEY_BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  user_already_exists: "emailExists",
  email_exists: "emailExists",
  email_address_invalid: "emailInvalid",
  validation_failed: "emailInvalid",
  weak_password: "weakPassword",
  same_password: "samePassword",
  over_request_rate_limit: "rateLimited",
  over_email_send_rate_limit: "emailRateLimited",
  request_timeout: "timeout",
  signup_disabled: "signupDisabled",
  email_provider_disabled: "signupDisabled",
};

const KEY_BY_TEXT: [RegExp, AuthErrorKey][] = [
  [/invalid login credentials|invalid credentials/i, "invalidCredentials"],
  [/email not confirmed/i, "emailNotConfirmed"],
  [/already (been )?registered|already exists/i, "emailExists"],
  [/should be different/i, "samePassword"],
  [/password should|weak password|password is too weak/i, "weakPassword"],
  [/email rate limit/i, "emailRateLimited"],
  [/rate limit|too many requests|only request this after/i, "rateLimited"],
  [/invalid format|unable to validate email|invalid email/i, "emailInvalid"],
  [/signups? not allowed|signups? (are )?disabled/i, "signupDisabled"],
  [/timeout|timed out/i, "timeout"],
];

export function authErrorKey(error: AuthLikeError): AuthErrorKey | null {
  if (!error) return null;
  if (error.code && KEY_BY_CODE[error.code]) return KEY_BY_CODE[error.code];
  const msg = error.message ?? "";
  for (const [re, key] of KEY_BY_TEXT) if (re.test(msg)) return key;
  console.error(`[auth] error sense clau (${error.code ?? error.status ?? "?"}): ${msg}`);
  return null;
}

/**
 * Els avisos que arriben al login per l'adreça (`/login?error=…`).
 *
 * Abans hi viatjava la frase sencera, en català, i el login l'ensenyava tal
 * qual: qualsevol podia enviar un enllaç a la pantalla d'entrada de debò amb
 * el text que volgués («El teu compte està bloquejat, truca al…»). Ara només hi
 * va un codi d'aquesta llista; qualsevol altra cosa no es pinta.
 */
export const LOGIN_URL_ERRORS = ["link", "preExpired"] as const;
export type LoginUrlError = (typeof LOGIN_URL_ERRORS)[number];
export function loginUrlError(value: string | null): LoginUrlError | null {
  return (LOGIN_URL_ERRORS as readonly string[]).includes(value ?? "")
    ? (value as LoginUrlError)
    : null;
}
