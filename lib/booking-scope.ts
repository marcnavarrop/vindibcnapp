/**
 * Amb qui pot reservar un client (decisió de Marc, fase 2 del client).
 *
 * LA REGLA
 *
 *   · Individual i parelles: NOMÉS amb el seu entrenador assignat
 *     (`clients.assigned_trainer_id`). De moment no es pot triar un altre.
 *   · Grup: amb qualsevol professional que ofereixi Grup a la seva
 *     disponibilitat.
 *   · Fisioteràpia: amb qualsevol professional que ofereixi Fisioteràpia.
 *   · Sense entrenador assignat: ni individual ni parelles fins que el centre
 *     n'hi assigni un. Grup i fisio, sí.
 *
 * «QUI OFEREIX EL SERVEI» ES MIRA A LA DISPONIBILITAT, NO A L'ESPECIALITAT
 *
 * `profiles.specialty` només tria els serveis per defecte d'una franja nova
 * (`defaultServiceTypesFor`); cada franja declara els seus i es poden editar.
 * Si aquesta regla filtrés per especialitat deixaria fora, per error, qualsevol
 * professional amb l'especialitat buida o mal posada. Per això aquí NO hi ha
 * cap filtre per a grup i fisio: ja ho fan la disponibilitat
 * (`assertWithinAvailability`, `freeServicesAt`) com fins ara.
 *
 * A QUI S'APLICA
 *
 * Només al que fa el CLIENT: reservar, apuntar-se a la cua, les sèries i les
 * seves alternatives, l'allargament automàtic d'una sèrie i la promoció des de
 * la cua. L'admin i l'entrenador, quan reserven per a un client, no hi passen:
 * l'admin decideix, i l'entrenador ja només pot reservar als seus
 * (`assertMayBookFor`).
 *
 * VIU AQUÍ, SENSE `server-only`, PERQUÈ LA FAN SERVIR LES DUES BANDES: el
 * calendari del client per no ensenyar el que el servidor rebutjaria, i el
 * servidor per rebutjar-ho encara que algú enviï el formulari a mà.
 */
import type { ServiceType } from "@/types/database";

/** Els serveis que només es poden fer amb l'entrenador assignat. */
export const ASSIGNED_ONLY_SERVICES: readonly ServiceType[] = [
  "ep_individual",
  "ep_parejas",
];

export function requiresAssignedTrainer(serviceType: ServiceType): boolean {
  return ASSIGNED_ONLY_SERVICES.includes(serviceType);
}

/**
 * `ok`, o per què no:
 *   · `noAssignedTrainer`: el client no té entrenador i el servei en demana.
 *   · `notAssignedTrainer`: el professional no és el seu entrenador.
 */
export type BookingScope = "ok" | "noAssignedTrainer" | "notAssignedTrainer";

export function clientBookingScope(input: {
  serviceType: ServiceType;
  /** `null` = «m'és igual qui» (només passa a la cua). */
  trainerId: string | null;
  assignedTrainerId: string | null;
}): BookingScope {
  if (!requiresAssignedTrainer(input.serviceType)) return "ok";
  if (!input.assignedTrainerId) return "noAssignedTrainer";
  // A la cua, «m'és igual qui» en un servei d'assignat vol dir el seu
  // entrenador: la promoció ho comprova amb el professional real de la franja.
  if (input.trainerId === null) return "ok";
  return input.trainerId === input.assignedTrainerId ? "ok" : "notAssignedTrainer";
}

/**
 * El que el servidor llança quan la regla diu que no. Les accions del client el
 * reconeixen i en tornen el codi, perquè el text el posa la pantalla en
 * l'idioma de qui llegeix.
 */
export class BookingScopeError extends Error {
  constructor(public readonly scope: Exclude<BookingScope, "ok">) {
    super(
      scope === "noAssignedTrainer"
        ? "Encara no tens entrenador assignat: no pots reservar aquest servei."
        : "Aquest servei només el pots reservar amb el teu entrenador.",
    );
    this.name = "BookingScopeError";
  }
}

export function assertClientBookingScope(
  input: Parameters<typeof clientBookingScope>[0],
): void {
  const scope = clientBookingScope(input);
  if (scope !== "ok") throw new BookingScopeError(scope);
}

/**
 * El codi d'error que les accions del client tornen quan la regla diu que no.
 * Accepta l'excepció que llança el servidor o el motiu ja resolt (el pla d'una
 * sèrie el porta a `scope`). Qualsevol altra cosa és `null`: no és d'aquesta
 * regla, i l'acció segueix amb el seu «no s'ha pogut» de sempre.
 */
export function scopeErrorCode(
  e: unknown,
): "notYourTrainer" | "noAssignedTrainer" | null {
  const scope =
    e instanceof BookingScopeError
      ? e.scope
      : e === "noAssignedTrainer" || e === "notAssignedTrainer"
        ? e
        : null;
  if (!scope) return null;
  return scope === "noAssignedTrainer" ? "noAssignedTrainer" : "notYourTrainer";
}
