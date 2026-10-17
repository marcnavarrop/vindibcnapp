/**
 * QUI POT LLEGIR LA NOTA D'UNA SESSIÓ (0079, 0125, 0126). La mateixa regla que
 * `can_read_session_note` de la base, en un mòdul pur: la fa servir la
 * simulació (on no hi ha RLS) i és la que expliquen les pantalles.
 *
 *   · admin: totes;
 *   · el client: les de les seves sessions;
 *   · sessió de FISIOTERÀPIA (historial clínic, com la 0110): qualsevol fisio,
 *     qui va fer la sessió i l'entrenador ASSIGNAT del client (aquest, només
 *     llegir);
 *   · qualsevol ALTRA sessió: qui la va fer i l'entrenador assignat;
 *   · l'equip, sempre demo amb demo.
 *
 * Escriure-la només ho pot fer qui va fer la sessió (la base ho mana).
 */
import { demoCompatible, type DemoWorld } from "@/lib/demo-accounts";
import type { ServiceType, Specialty, UserRole } from "@/types/database";

export type NoteViewer = { id: string; role: UserRole; specialty: Specialty | null };
export type NoteSession = {
  clientId: string;
  clientProfileId: string | null;
  trainerId: string | null;
  serviceType: ServiceType;
  assignedTrainerId: string | null;
};

export function canReadSessionNote(v: NoteViewer, s: NoteSession, w: DemoWorld): boolean {
  if (v.role === "admin") return true;
  if (v.role === "client") return !!s.clientProfileId && s.clientProfileId === v.id;
  if (v.role !== "trainer" || !demoCompatible(w, s.clientId, v.id)) return false;
  const own = s.trainerId === v.id;
  const assigned = s.assignedTrainerId === v.id;
  if (s.serviceType === "fisioterapia") return v.specialty === "fisioterapeuta" || own || assigned;
  return own || assigned;
}
