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
