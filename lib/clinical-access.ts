/**
 * QUI POT FER QUÈ AMB L'HISTORIAL CLÍNIC (0110). La mateixa regla que la RLS
 * de `clinical_first_visits` i `clinical_followups`, en un mòdul pur perquè la
 * pantalla no ofereixi el que la base rebutjaria:
 *
 *                         llegir   primera visita   seguiment            esborrar
 *   admin                 tot      crear i editar   crear i editar tots  sí
 *   fisioterapeuta        tot      crear i editar   crear; editar els    no
 *   (qualsevol client)                              SEUS
 *   entrenador ASSIGNAT   el seu   no               no                   no
 *   altres entrenadors    res      —                —                    —
 *   el client             res      —                —                    —
 *
 * I «demo amb demo» (que la base també mira, `same_world`): un professional
 * demo només amb clients demo, i un de real mai amb un client demo. L'admin
 * ho veu tot.
 *
 * Sense `server-only`: la fan servir les fitxes (què s'ensenya) i les accions
 * (què s'accepta).
 */
import { demoCompatible } from "@/lib/demo-accounts";
import type { Specialty, UserRole } from "@/types/database";

export type ClinicalViewer = { id: string; role: UserRole; specialty: Specialty | null };
export type ClinicalSubject = { id: string; assignedTrainerId: string | null };

const isPhysio = (v: ClinicalViewer) => v.role === "trainer" && v.specialty === "fisioterapeuta";

export function canReadClinical(v: ClinicalViewer, c: ClinicalSubject): boolean {
  if (v.role === "admin") return true;
  if (v.role !== "trainer" || !demoCompatible(c.id, v.id)) return false;
  return isPhysio(v) || c.assignedTrainerId === v.id;
}

/** Crear i editar la primera visita, i afegir seguiments. */
export function canWriteClinical(v: ClinicalViewer, c: ClinicalSubject): boolean {
  if (v.role === "admin") return true;
  return isPhysio(v) && demoCompatible(c.id, v.id);
}

/** Editar UN seguiment: l'admin, o el fisio que el va escriure. */
export function canEditFollowup(
  v: ClinicalViewer,
  c: ClinicalSubject,
  authorId: string | null,
): boolean {
  if (v.role === "admin") return true;
  return canWriteClinical(v, c) && authorId === v.id;
}

/** Esborrar: només l'admin. */
export function canDeleteClinical(v: ClinicalViewer): boolean {
  return v.role === "admin";
}

/** El text, entre 1 i 20.000 caràcters (el `check` de la 0110). */
export const CLINICAL_MAX = 20000;
