import "server-only";
import {
  slotOf,
  slotsFor,
  slotToHHMM,
  SLOT_MINUTES,
} from "@/lib/availability-slots";
import { SESSION_DURATION_MINUTES } from "@/lib/labels";
import { parseServiceTypes } from "@/lib/labels";
import { centerToday } from "@/lib/center-time";
import {
  createAvailabilityRules,
  updateAvailabilityRule,
  deleteAvailabilityRule,
  getAvailabilityRule,
} from "@/lib/data/availability";
import {
  previewOrphans,
  orphanCount,
  cancelOrphans,
  selectionFromForm,
  mayManage,
  actingTrainerId,
  outcomeSummary,
  type Actor,
  type Orphans,
} from "@/lib/data/availability-orphans";
import type { ServiceType } from "@/types/database";

/**
 * Validació de l'alta i l'edició d'una franja de disponibilitat.
 *
 * FINS ARA AQUÍ NO HI HAVIA RES. Les Server Actions feien
 * `String(formData.get("startTime"))` i ho enviaven a la base tal com arribava:
 * ni format, ni ordre, ni res. L'única cosa que impedia desar una hora rara era
 * el `step` de l'`<input type="time">` del navegador —i un `step` del navegador
 * no és una validació: es pot treure des de les eines de desenvolupament, i
 * llavors la franja s'desava sense que ningú digués res.
 *
 * Es va comprovar: amb el `step` fora, `09:30–10:30` entrava a la base
 * perfectament. El que passava després és que tota la lògica de sota truncava
 * els minuts i oferia als clients una franja que el professional no havia
 * demanat mai. Tapar el forat al navegador i deixar el servidor obert era
 * precisament el problema.
 *
 * PER QUÈ NO HI HA CAP CONSTRAINT NOVA A LA BASE
 *
 * La columna és `time` i pot guardar qualsevol minut, i està bé que pugui: des
 * del bloc 1, llegir una regla arrodoneix els extrems cap a DINS, així que una
 * fila fora de graella —d'on sigui que vingui— mai ofereix més del que declara.
 * La graella és una política d'aquesta pantalla, no una veritat de les dades, i
 * per això es fa complir aquí.
 */

export type AvailabilityFormState = {
  error?: string;
  ok?: boolean;
  /**
   * El canvi deixaria reserves (o proves, o esperes) fora de la disponibilitat.
   * NO s'ha desat res: la pantalla les ensenya i espera la confirmació.
   */
  pending?: { orphans: Orphans };
  /** Què s'ha cancel·lat en confirmar. */
  notice?: string;
  /** El canvi s'ha desat, però alguna cancel·lació no ha anat bé. */
  warning?: string;
};

/** Errors de validació, per distingir-los dels que venen de la base. */
class InvalidInput extends Error {}

/**
 * Llegeix una hora de rellotge del formulari i comprova que caigui a la graella.
 *
 * Accepta "HH:MM" i "HH:MM:SS" (el navegador envia el segon format quan el
 * `step` baixa d'un minut, i val més acceptar-lo que petar-hi).
 */
function parseClockTime(raw: string, camp: string): string {
  const v = raw.trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.exec(v);
  if (!m) throw new InvalidInput(`L'${camp} no és una hora vàlida.`);
  const minuts = Number(m[2]);
  if (minuts % SLOT_MINUTES !== 0)
    throw new InvalidInput(
      `L'${camp} ha d'anar en punt o a mitja hora (${SLOT_MINUTES} minuts).`,
    );
  return `${m[1]}:${m[2]}`;
}

/** Llegeix un dia "YYYY-MM-DD" i comprova que existeixi de debò. */
function parseDay(raw: string, camp: string): string {
  const v = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new InvalidInput(`La data ${camp} no és vàlida.`);
  const d = new Date(`${v}T00:00:00Z`);
  // `new Date("2026-02-31")` no peta: se'n va al 3 de març. Es compara el que
  // torna amb el que s'ha escrit per enxampar-ho.
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v)
    throw new InvalidInput(`La data ${camp} no existeix.`);
  return v;
}

function parseWeekdays(fd: FormData): number[] {
  const dies = fd
    .getAll("weekdays")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (dies.length === 0)
    throw new InvalidInput("Marca com a mínim un dia de la setmana.");
  return [...new Set(dies)];
}

function parseServices(fd: FormData): ServiceType[] {
  const serveis = parseServiceTypes(fd.getAll("serviceTypes"));
  if (serveis.length === 0)
    throw new InvalidInput(
      "Marca com a mínim un servei: una franja sense serveis no la pot reservar ningú.",
    );
  return serveis;
}

/** El tros comú de l'alta i l'edició: hores, validesa i serveis. */
function parseCommon(fd: FormData) {
  const startTime = parseClockTime(String(fd.get("startTime") ?? ""), "hora d'inici");
  const endTime = parseClockTime(String(fd.get("endTime") ?? ""), "hora de fi");

  const startSlot = slotOf(startTime);
  const endSlot = slotOf(endTime);

  if (endSlot <= startSlot)
    throw new InvalidInput("L'hora de fi ha de ser posterior a la d'inici.");

  // Una franja més curta que una sessió no la pot reservar ningú. Abans es
  // podia desar igualment i quedava una regla invisible: hi era, ocupava una
  // fila a la pantalla i no oferia res. És exactament la manera de fallar que
  // va portar fins aquí.
  const calen = slotsFor(SESSION_DURATION_MINUTES);
  if (endSlot - startSlot < calen)
    throw new InvalidInput(
      `La franja ha de durar com a mínim una sessió (${SESSION_DURATION_MINUTES} minuts): ` +
        `de ${slotToHHMM(startSlot)} a ${slotToHHMM(startSlot + calen)} com a mínim.`,
    );

  const validFrom = fd.get("validFrom")
    ? parseDay(String(fd.get("validFrom")), "«vàlida des de»")
    : centerToday();

  const finsRaw = String(fd.get("validUntil") ?? "").trim();
  const validUntil = finsRaw ? parseDay(finsRaw, "«fins a»") : null;
  if (validUntil && validUntil < validFrom)
    throw new InvalidInput("La data «fins a» no pot ser anterior a la d'inici.");

  return {
    startTime,
    endTime,
    validFrom,
    validUntil,
    serviceTypes: parseServices(fd),
  };
}

/** Converteix qualsevol excepció en un missatge per a la pantalla. */
function toState(e: unknown, generic: string): AvailabilityFormState {
  if (e instanceof InvalidInput) return { error: e.message };
  // Qualsevol altra cosa ve de la base (RLS, la check constraint de la 0013…).
  // No s'ensenya en cru: diria coses com "new row violates row-level security".
  return { error: generic };
}

/** Alta d'una franja per a cada dia marcat. */
export async function submitAvailabilityRules(
  trainerId: string,
  fd: FormData,
): Promise<AvailabilityFormState> {
  try {
    const comu = parseCommon(fd);
    await createAvailabilityRules({
      trainerId,
      weekdays: parseWeekdays(fd),
      ...comu,
    });
    return { ok: true };
  } catch (e) {
    return toState(e, "No s'ha pogut desar la disponibilitat.");
  }
}

/** Si l'usuari ja ha vist la llista i ha dit «Desar i cancel·lar les marcades». */
const isConfirmation = (fd: FormData) => fd.get("confirmOrphans") === "1";

/**
 * Desa el canvi i, si venia confirmat, cancel·la el que s'ha marcat.
 *
 * L'ORDRE ÉS AQUEST A POSTA. Primer el canvi, després les cancel·lacions: si
 * aquestes fallen, queda el que hi havia avui (disponibilitat canviada i
 * reserves encara reservades, visibles al plafó per tornar-ho a provar). A
 * l'inrevés, un canvi que fallés deixaria reserves cancel·lades per res.
 */
async function saveThenCancel(
  save: () => Promise<void>,
  trainerId: string,
  actor: Actor,
  fd: FormData,
): Promise<AvailabilityFormState> {
  await save();
  if (!isConfirmation(fd)) return { ok: true };
  const { notice, warning } = outcomeSummary(
    await cancelOrphans(trainerId, actingTrainerId(actor), selectionFromForm(fd)),
  );
  return {
    ok: true,
    ...(notice ? { notice } : {}),
    ...(warning ? { warning: `El canvi s'ha desat. ${warning}` } : {}),
  };
}

/**
 * Edició d'una franja concreta: hores, serveis i vigència. Els dies no es
 * toquen: la regla ja té el seu.
 *
 * Retallar-la, treure-li un servei o escurçar-ne la vigència pot deixar
 * reserves sense on caure. Si és així, NO es desa: torna la llista i la
 * pantalla demana què fer-ne.
 */
export async function submitAvailabilityUpdate(
  fd: FormData,
  actor: Actor,
): Promise<AvailabilityFormState> {
  try {
    const id = String(fd.get("id") ?? "").trim();
    if (!id) throw new InvalidInput("Falta la franja que s'està editant.");
    const input = parseCommon(fd);

    const rule = await getAvailabilityRule(id);
    if (!rule || !mayManage(actor, rule.trainerId))
      throw new InvalidInput("Aquesta franja no existeix o no és teva.");

    if (!isConfirmation(fd)) {
      const orphans = await previewOrphans(rule.trainerId, (now) => ({
        rules: now.rules.map((r) => (r.id === id ? { ...r, ...input } : r)),
        blocks: now.blocks,
      }));
      if (orphanCount(orphans) > 0) return { pending: { orphans } };
    }

    return await saveThenCancel(
      () => updateAvailabilityRule(id, input),
      rule.trainerId,
      actor,
      fd,
    );
  } catch (e) {
    return toState(e, "No s'ha pogut desar la franja.");
  }
}

/**
 * Esborrar una franja. Abans era un formulari sense estat que esborrava a
 * l'instant, i les reserves que hi queien es quedaven reservades sense que
 * ningú ho sabés. Ara passa pel mateix pas de confirmació que l'edició.
 */
export async function submitAvailabilityDelete(
  fd: FormData,
  actor: Actor,
): Promise<AvailabilityFormState> {
  try {
    const id = String(fd.get("id") ?? "").trim();
    if (!id) throw new InvalidInput("Falta la franja que s'ha d'esborrar.");

    const rule = await getAvailabilityRule(id);
    if (!rule || !mayManage(actor, rule.trainerId))
      throw new InvalidInput("Aquesta franja no existeix o no és teva.");

    if (!isConfirmation(fd)) {
      const orphans = await previewOrphans(rule.trainerId, (now) => ({
        rules: now.rules.filter((r) => r.id !== id),
        blocks: now.blocks,
      }));
      if (orphanCount(orphans) > 0) return { pending: { orphans } };
    }

    return await saveThenCancel(
      () => deleteAvailabilityRule(id),
      rule.trainerId,
      actor,
      fd,
    );
  } catch (e) {
    return toState(e, "No s'ha pogut esborrar la franja.");
  }
}
