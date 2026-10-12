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
 * l'admin decideix, i l'entrenador té la seva pròpia regla, `staffBookingScope`
 * (més avall). Per això un professional SÍ pot reservar individual a un client
 * que té un altre entrenador assignat: ho decideix l'equip, no el client
 * (decisió d'en Marc, 12/10/2026).
 *
 * VIU AQUÍ, SENSE `server-only`, PERQUÈ LA FAN SERVIR LES DUES BANDES: el
 * calendari del client per no ensenyar el que el servidor rebutjaria, i el
 * servidor per rebutjar-ho encara que algú enviï el formulari a mà.
 */
import type { ServiceType, Specialty } from "@/types/database";
import { demoCompatible } from "@/lib/demo-accounts";

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
export type BookingScope = "ok" | "noAssignedTrainer" | "notAssignedTrainer" | "demoMismatch";

export function clientBookingScope(input: {
  serviceType: ServiceType;
  /** `null` = «m'és igual qui» (només passa a la cua). */
  trainerId: string | null;
  assignedTrainerId: string | null;
  /**
   * La fitxa del client (`clients.id`): els comptes demo i els reals no es
   * barregen (`lib/demo-accounts.ts`). Obligatori a posta: el compilador
   * assenyala qualsevol camí que se n'oblidi. `null` = no se sap (pantalla).
   */
  clientId: string | null;
}): BookingScope {
  // Demo amb demo, real amb real, per a TOTS els serveis.
  if (!demoCompatible(input.clientId, input.trainerId)) return "demoMismatch";
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
        : scope === "demoMismatch"
          ? "Aquest professional no està disponible."
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
): "notYourTrainer" | "noAssignedTrainer" | "trainerUnavailable" | null {
  const scope =
    e instanceof BookingScopeError
      ? e.scope
      : e === "noAssignedTrainer" || e === "notAssignedTrainer" || e === "demoMismatch"
        ? e
        : null;
  if (!scope) return null;
  if (scope === "demoMismatch") return "trainerUnavailable";
  return scope === "noAssignedTrainer" ? "noAssignedTrainer" : "notYourTrainer";
}

/**
 * QUÈ POT RESERVAR UN PROFESSIONAL PER A UN CLIENT (tiquet d'en Raul, 8/10;
 * decisions d'en Marc, 12/10/2026).
 *
 *   1. Els SEUS clients (assignats): qualsevol servei, a qualsevol agenda, amb
 *      bo o de cortesia. Com sempre. Que el pugui posar a l'agenda d'un company
 *      és A POSTA: és la coordinació (la Laia reserva fisio amb en Sergi a una
 *      clienta seva).
 *   2. GRUP: qualsevol client real, a qualsevol grup del centre. Els clients de
 *      grup canvien d'horari i d'entrenador lliurement.
 *   3. La SEVA ESPECIALITAT, a la SEVA agenda: qualsevol client real (el fisio,
 *      fisioteràpia; l'entrenador, individual i parelles). Sense especialitat,
 *      res d'això: només els seus clients i grups.
 *
 *   · Cortesia (sense bo): només als seus clients, també en grup i en
 *     especialitat.
 *   · «Demo amb demo» NO viu aquí: la mira `demoCompatible` abans, a tots els
 *     camins, com fins ara.
 *   · La disponibilitat tampoc: `assertWithinAvailability` la segueix mirant.
 *
 * Reprogramar fa servir la mateixa regla (sense cortesia: moure una sessió no
 * en regala cap). Cancel·lar i marcar feta tenen la seva porta a la base
 * (`cancel_reservation` i `complete_reservation`, 0107).
 *
 * Pura i sense `server-only`: la pantalla la fa servir per no oferir el que el
 * servidor rebutjaria.
 */
export type StaffScope = "ok" | "courtesyNotYours" | "otherAgenda" | "notYourSpecialty";

/** Els serveis de cada especialitat, per a la regla 3. */
export function specialtyServices(specialty: Specialty | null): ServiceType[] {
  if (specialty === "fisioterapeuta") return ["fisioterapia"];
  if (specialty === "entrenador") return ["ep_individual", "ep_parejas"];
  return [];
}

export function staffBookingScope(input: {
  /** El client és assignat a qui reserva. */
  isOwnClient: boolean;
  serviceType: ServiceType;
  /** L'agenda on va la sessió. */
  trainerId: string | null;
  viewerId: string;
  viewerSpecialty: Specialty | null;
  /** Sense bo. */
  courtesy: boolean;
}): StaffScope {
  if (input.isOwnClient) return "ok";
  if (input.courtesy) return "courtesyNotYours";
  if (input.serviceType === "grupo_reducido") return "ok";
  if (input.trainerId !== input.viewerId) return "otherAgenda";
  return specialtyServices(input.viewerSpecialty).includes(input.serviceType)
    ? "ok"
    : "notYourSpecialty";
}

/** Els serveis que un professional pot reservar a un client que no és seu. */
export function servicesForOthersClients(specialty: Specialty | null): ServiceType[] {
  return ["grupo_reducido", ...specialtyServices(specialty)];
}

/** El text, en català (admin i professional), de cada «no». */
export const STAFF_SCOPE_MESSAGES: Record<Exclude<StaffScope, "ok">, string> = {
  courtesyNotYours:
    "Les sessions de cortesia només les pots fer als teus clients. Per a aquest client, cal un bo.",
  otherAgenda:
    "Aquest client no és teu: a l'agenda d'un company només el pots apuntar a un grup.",
  notYourSpecialty:
    "Aquest client no és teu: només li pots reservar grup o la teva especialitat, a la teva agenda.",
};
