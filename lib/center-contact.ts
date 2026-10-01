/**
 * EL CONTACTE DEL CENTRE: la forma, la validació i com es pinta.
 *
 * Es desa a `center_settings` (0100) i l'admin el posa a Configuració →
 * Centre. Aquest mòdul és pur (sense servidor ni base) perquè el fan servir
 * igual el formulari, el manual, les pantalles del client, les pàgines
 * públiques i els correus.
 *
 * BUIT ÉS NULL. Res d'aquí no pinta mai un text provisional ni una línia buida:
 * qui pinta pregunta `hasContact` i, si no n'hi ha, no hi posa res (o la frase
 * sense el contacte).
 */

/** El que es pot ensenyar a qualsevol (també sense sessió). */
export type PublicContact = {
  /** «+34 931 23 45 67». */
  phone: string | null;
  /** Aquest mateix telèfon té WhatsApp. */
  whatsapp: boolean;
  /** La bústia que el centre llegeix. */
  email: string | null;
  address: string | null;
};

/** Tot el que es desa (inclou les dades legals i el correu intern). */
export type CenterContact = PublicContact & {
  /** On van els avisos interns. Només el servidor. */
  notifyEmail: string | null;
  legalName: string | null;
  taxId: string | null;
};

export const EMPTY_CONTACT: CenterContact = {
  phone: null,
  whatsapp: false,
  email: null,
  notifyEmail: null,
  address: null,
  legalName: null,
  taxId: null,
};

export function publicContact(c: CenterContact): PublicContact {
  return { phone: c.phone, whatsapp: c.whatsapp, email: c.email, address: c.address };
}

/** Hi ha alguna via per contactar (telèfon o correu)? */
export function hasContact(c: Pick<PublicContact, "phone" | "email"> | null | undefined): boolean {
  return !!c && (!!c.phone || !!c.email);
}

// ─── Telèfon ────────────────────────────────────────────────────────────────

/**
 * El telèfon tal com l'escriu l'admin → la forma desada, o un error.
 *
 *   «931234567», «931 23 45 67», «93-123-45-67» → «+34 931 23 45 67»
 *   «+34 600 100 200» → «+34 600 10 02 00»
 *   «+44 20 7946 0958» → «+44 2079460958» (fora d'Espanya, sense agrupar)
 *
 * Nou xifres sense prefix: s'hi posa el +34. Buit → null.
 */
export function normalizePhone(input: string): { value: string | null } | { error: string } {
  const raw = input.trim();
  if (!raw) return { value: null };
  if (!/^\+?[0-9 ().-]+$/.test(raw)) return { error: "El telèfon només pot tenir xifres, espais, guions i un + al davant." };
  let digits = raw.replace(/[^0-9]/g, "");
  const plus = raw.startsWith("+") || raw.startsWith("00");
  if (raw.startsWith("00")) digits = digits.slice(2);
  if (!plus) {
    if (digits.length !== 9) return { error: "Un telèfon d'Espanya té 9 xifres. Si és d'un altre país, posa-hi el prefix (+44…)." };
    digits = `34${digits}`;
  }
  if (digits.length < 9 || digits.length > 15) return { error: "Aquest telèfon no té una llargada vàlida." };
  if (digits.startsWith("34")) {
    const n = digits.slice(2);
    if (n.length !== 9) return { error: "Un telèfon d'Espanya té 9 xifres després del +34." };
    return { value: `+34 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}` };
  }
  return { value: `+${digits.slice(0, 2)} ${digits.slice(2)}` };
}

/** Com es llegeix: d'Espanya, sense el +34 («931 23 45 67»). */
export function displayPhone(phone: string): string {
  return phone.startsWith("+34 ") ? phone.slice(4) : phone;
}

export function telHref(phone: string): string {
  return `tel:+${phone.replace(/[^0-9]/g, "")}`;
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
}

// ─── Correu ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(input: string): { value: string | null } | { error: string } {
  const v = input.trim().toLowerCase();
  if (!v) return { value: null };
  if (v.length > 254 || !EMAIL_RE.test(v)) return { error: "Aquest correu no sembla vàlid." };
  return { value: v };
}

/** «VindiBCN <hola@vindibcn.com>» → «hola@vindibcn.com». */
export function addressOf(from: string | null | undefined): string | null {
  if (!from) return null;
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase() || null;
}

// ─── Text lliure ────────────────────────────────────────────────────────────

export function normalizeText(
  input: string,
  min: number,
  max: number,
  what: string,
): { value: string | null } | { error: string } {
  const v = input.trim().replace(/\s+/g, " ");
  if (!v) return { value: null };
  if (v.length < min || v.length > max) return { error: `${what}: entre ${min} i ${max} caràcters.` };
  return { value: v };
}

export function normalizeTaxId(input: string): { value: string | null } | { error: string } {
  const v = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!v) return { value: null };
  if (!/^[A-Z0-9][A-Z0-9-]{6,13}[A-Z0-9]$/.test(v)) return { error: "El NIF / CIF no sembla vàlid (lletres i xifres, sense espais)." };
  return { value: v };
}

// ─── Text pla ───────────────────────────────────────────────────────────────

/**
 * «931 23 45 67 (també WhatsApp) · recepcio@vindibcn.cat», o null si no hi ha
 * res. Per als textos (manual, correus en text pla); `whatsappWord` és la
 * paraula de cada idioma.
 */
export function contactText(c: PublicContact, whatsappWord: string): string | null {
  const parts: string[] = [];
  if (c.phone) parts.push(c.whatsapp ? `${displayPhone(c.phone)} (${whatsappWord})` : displayPhone(c.phone));
  if (c.email) parts.push(c.email);
  return parts.length ? parts.join(" · ") : null;
}
