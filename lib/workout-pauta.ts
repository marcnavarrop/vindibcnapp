/**
 * La pauta d'un exercici assignat (0112): sèries, repeticions o temps, càrrega
 * i descans. Tot opcional. Mòdul pur: el fan servir l'acció del servidor, les
 * pantalles i `npm run workout:check`.
 *
 * Els límits són els `check` de la base: si aquí s'accepta, la base també.
 */

export const PAUTA_MAX = { name: 40, reps: 20, load: 30, sets: 99, rest: 3600, notes: 500 } as const;

export type PautaValues = {
  sets: number | null;
  reps: string | null;
  load: string | null;
  restSeconds: number | null;
  notes: string | null;
};

export type PautaResult = { ok: true; value: PautaValues } | { ok: false; error: string };

const text = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s === "" ? null : s;
};

/** Enter dins de [min, max], o null si és buit. `undefined` si no és vàlid. */
function intIn(v: FormDataEntryValue | null, min: number, max: number): number | null | undefined {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n >= min && n <= max ? n : undefined;
}

/** Llegeix i valida la pauta d'un formulari. Errors en català (pantalles de l'equip). */
export function parsePauta(fd: FormData): PautaResult {
  const sets = intIn(fd.get("sets"), 1, PAUTA_MAX.sets);
  if (sets === undefined) return { ok: false, error: `Les sèries han de ser un número de 1 a ${PAUTA_MAX.sets}.` };
  const restSeconds = intIn(fd.get("restSeconds"), 0, PAUTA_MAX.rest);
  if (restSeconds === undefined)
    return { ok: false, error: `El descans va en segons, de 0 a ${PAUTA_MAX.rest}.` };
  const reps = text(fd.get("reps"));
  if (reps && reps.length > PAUTA_MAX.reps)
    return { ok: false, error: `Repeticions o temps: com a molt ${PAUTA_MAX.reps} caràcters (p. ex. «8-10» o «30 s»).` };
  const load = text(fd.get("load"));
  if (load && load.length > PAUTA_MAX.load)
    return { ok: false, error: `Càrrega: com a molt ${PAUTA_MAX.load} caràcters (p. ex. «20 kg» o «RPE 7»).` };
  const notes = String(fd.get("notes") ?? "").trim() || null;
  if (notes && notes.length > PAUTA_MAX.notes)
    return { ok: false, error: `Les notes no poden passar de ${PAUTA_MAX.notes} caràcters.` };
  return { ok: true, value: { sets, reps, load, restSeconds, notes } };
}

/** Nom d'un dia: buit = sense nom («Dia N»). `undefined` si és massa llarg. */
export function parseDayName(v: FormDataEntryValue | string | null): string | null | undefined {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  if (s === "") return null;
  return s.length > PAUTA_MAX.name ? undefined : s;
}

/** «90 s», «2 min», «1 min 30 s». */
export function formatRest(seconds: number, units: { s: string; min: string } = { s: "s", min: "min" }): string {
  if (seconds < 60) return `${seconds} ${units.s}`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} ${units.min} ${s} ${units.s}` : `${m} ${units.min}`;
}

/** Hi ha alguna dada de pauta? */
export function hasPauta(p: Pick<PautaValues, "sets" | "reps" | "load" | "restSeconds">): boolean {
  return p.sets != null || !!p.reps || !!p.load || p.restSeconds != null;
}

/** Mou un element una posició amunt (-1) o avall (+1). Null si ja és a la vora. */
export function moveInList<T>(list: T[], index: number, dir: -1 | 1): T[] | null {
  const to = index + dir;
  if (index < 0 || to < 0 || to >= list.length) return null;
  const copy = [...list];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}

/**
 * El dia que TOCA (la pantalla del client s'obre per aquí): el següent, en
 * cicle, al darrer dia que va marcar fet. Si avui ja n'ha marcat un, toca
 * encara aquell (no saltem al següent el mateix dia). Sense cap «dia fet», el
 * primer. Els «dia fet» d'un dia esborrat no compten.
 *
 * `days` en ordre; `logs` del més recent al més antic.
 */
export function nextWorkoutDayId(
  days: { id: string }[],
  logs: { dayId: string | null; doneOn: string }[],
  today: string,
): string | null {
  if (days.length === 0) return null;
  const last = logs.find((l) => l.dayId && days.some((d) => d.id === l.dayId));
  if (!last) return days[0].id;
  const idx = days.findIndex((d) => d.id === last.dayId);
  if (last.doneOn === today) return days[idx].id;
  return days[(idx + 1) % days.length].id;
}
