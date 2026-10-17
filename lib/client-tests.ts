/**
 * Els tests d'avaluació d'un client (0113): validació dels formularis, la
 * diferència amb el registre anterior i la geometria de la gràfica. Mòdul pur:
 * el fan servir les accions del servidor, les pantalles (equip i client) i
 * `npm run tests:check`.
 *
 * Els límits són els `check` de la base: si aquí s'accepta, la base també.
 */

export const TEST_MAX = { title: 60, unit: 20, description: 1000, notes: 1000 } as const;

/** numeric(12,3): fins a 999.999.999,999. */
const VALUE_ABS_MAX = 999_999_999.999;

export type BetterWhen = "up" | "down" | "neutral";
export const BETTER_WHEN: BetterWhen[] = ["neutral", "up", "down"];

export type TestValues = {
  title: string;
  unit: string | null;
  description: string | null;
  betterWhen: BetterWhen;
};

export type EntryValues = {
  measuredOn: string;
  value: number;
  notes: string | null;
};

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const oneLine = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s === "" ? null : s;
};

/** Llegeix i valida un test. Errors en català (pantalles de l'equip). */
export function parseTest(fd: FormData): Parsed<TestValues> {
  const title = oneLine(fd.get("title"));
  if (!title) return { ok: false, error: "Posa-li un títol (p. ex. «Dominades»)." };
  if (title.length > TEST_MAX.title)
    return { ok: false, error: `El títol pot tenir com a molt ${TEST_MAX.title} caràcters.` };
  const unit = oneLine(fd.get("unit"));
  if (unit && unit.length > TEST_MAX.unit)
    return { ok: false, error: `La unitat pot tenir com a molt ${TEST_MAX.unit} caràcters (p. ex. «reps», «cm»).` };
  const description = String(fd.get("description") ?? "").trim() || null;
  if (description && description.length > TEST_MAX.description)
    return { ok: false, error: `La descripció no pot passar de ${TEST_MAX.description} caràcters.` };
  const raw = String(fd.get("betterWhen") ?? "neutral");
  const betterWhen = (BETTER_WHEN as string[]).includes(raw) ? (raw as BetterWhen) : "neutral";
  return { ok: true, value: { title, unit, description, betterWhen } };
}

/**
 * Un valor escrit a mà: «12», «12,5», «12.5», «-3», «1.234,5». Torna el número
 * arrodonit a 3 decimals, o null si no ho és.
 */
export function parseValue(v: FormDataEntryValue | string | null): number | null {
  let s = String(v ?? "").trim().replace(/\s/g, "");
  if (s === "") return null;
  // Si hi ha coma i punt, l'últim és el decimal i l'altre, els milers.
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else {
    s = s.replace(",", ".");
  }
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Math.round(Number(s) * 1000) / 1000;
  if (!Number.isFinite(n) || Math.abs(n) > VALUE_ABS_MAX) return null;
  return Object.is(n, -0) ? 0 : n;
}

/** Llegeix i valida un registre. `today` és el dia del centre (YYYY-MM-DD). */
export function parseEntry(fd: FormData, today: string): Parsed<EntryValues> {
  const measuredOn = String(fd.get("measuredOn") ?? "").trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredOn) || Number.isNaN(Date.parse(`${measuredOn}T00:00:00Z`)))
    return { ok: false, error: "La data no és vàlida." };
  if (measuredOn > today) return { ok: false, error: "La data no pot ser futura." };
  const value = parseValue(fd.get("value"));
  if (value === null) return { ok: false, error: "El valor ha de ser un número (p. ex. 12 o 12,5)." };
  const notes = String(fd.get("notes") ?? "").trim() || null;
  if (notes && notes.length > TEST_MAX.notes)
    return { ok: false, error: `L'observació no pot passar de ${TEST_MAX.notes} caràcters.` };
  return { ok: true, value: { measuredOn, value, notes } };
}

/** Ordre cronològic dels registres: per data i, el mateix dia, per creació. */
export function byDate<T extends { measuredOn: string; createdAt: string }>(a: T, b: T): number {
  return a.measuredOn.localeCompare(b.measuredOn) || a.createdAt.localeCompare(b.createdAt);
}

export type Trend = {
  /** Últim menys penúltim, arrodonit a 3 decimals. */
  diff: number;
  /** good = ha millorat, bad = ha empitjorat, same = igual o test neutre. */
  tone: "good" | "bad" | "same";
};

/** La diferència de l'últim registre amb l'anterior, amb el color que toca. */
export function trendOf(values: number[], betterWhen: BetterWhen): Trend | null {
  if (values.length < 2) return null;
  const diff = Math.round((values[values.length - 1] - values[values.length - 2]) * 1000) / 1000;
  if (diff === 0 || betterWhen === "neutral") return { diff, tone: "same" };
  const improved = betterWhen === "up" ? diff > 0 : diff < 0;
  return { diff, tone: improved ? "good" : "bad" };
}

const intlTag = (locale: string) => (locale === "ca" ? "ca-ES" : locale === "es" ? "es-ES" : "en-GB");

/** «12,5» en català i castellà, «12.5» en anglès. Fins a 3 decimals, sense zeros de més. */
export function formatValue(n: number, locale = "ca"): string {
  return new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 3, useGrouping: Math.abs(n) >= 10000 }).format(n);
}

/** «+2», «−1,5», «0». Amb el signe menys tipogràfic. */
export function formatDiff(n: number, locale = "ca"): string {
  if (n === 0) return formatValue(0, locale);
  return `${n > 0 ? "+" : "−"}${formatValue(Math.abs(n), locale)}`;
}

/** Valor amb la unitat: «12,5 cm», «8 reps», «8» si no en té. */
export function withUnit(text: string, unit: string | null): string {
  return unit ? `${text} ${unit}` : text;
}

// ─── Gràfica ────────────────────────────────────────────────────────────────

export const CHART = { w: 280, h: 120, padX: 8, padTop: 10, padBottom: 10 } as const;

export type ChartPoint = { x: number; y: number };

export type ChartGeometry = {
  points: ChartPoint[];
  /** El valor més alt i el més baix de debò (sense el marge), per als rètols. */
  max: number;
  min: number;
  /** On cauen (en Y, dins de `CHART.h`) el valor més alt i el més baix. */
  yMax: number;
  yMin: number;
};

/**
 * On va cada punt dins de la caixa `CHART`. L'eix X és el TEMPS (dues mesures
 * separades un mes queden més lluny que dues d'una setmana); si totes són del
 * mateix dia, en ordre. L'eix Y va del mínim al màxim amb un 10 % de marge; si
 * tots els valors són iguals, la línia queda al mig.
 *
 * `entries` en ordre cronològic.
 */
export function chartGeometry(entries: { measuredOn: string; value: number }[]): ChartGeometry | null {
  if (entries.length === 0) return null;
  const { w, h, padX, padTop, padBottom } = CHART;
  const values = entries.map((e) => e.value);
  const realMin = Math.min(...values);
  const realMax = Math.max(...values);
  let min = realMin;
  let max = realMax;
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;
  }
  const days = entries.map((e) => Date.parse(`${e.measuredOn}T00:00:00Z`) / 86_400_000);
  const first = days[0];
  const span = days[days.length - 1] - first;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;
  const yOf = (v: number) => round2(padTop + (1 - (v - min) / (max - min)) * innerH);
  const points = entries.map((e, i) => {
    const t = entries.length === 1 ? 0.5 : span > 0 ? (days[i] - first) / span : i / (entries.length - 1);
    return {
      x: round2(padX + t * innerW),
      y: yOf(e.value),
    };
  });
  return { points, max: realMax, min: realMin, yMax: yOf(realMax), yMin: yOf(realMin) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Normalitza un títol per comparar-lo: «  Dominades » = «dominades». */
export function titleKey(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}
