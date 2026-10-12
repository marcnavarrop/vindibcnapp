import { formatDate } from "@/lib/labels";

/**
 * QUAN LA BASE NO DEIXA GASTAR EL BO (0103)
 *
 * Des de la 0103, `book_group_slot` i `book_individual_slot` tornen a mirar el
 * bo dins de la base, amb la fila bloquejada: de qui és, de quin servei, en
 * quin estat i si ha caducat. És la mateixa regla que l'aplicació ja aplica
 * abans de cridar-les (`assertBonoUsable`, els filtres de reservar, la llista
 * d'espera, les sèries), així que avui aquestes respostes només surten en una
 * cursa —el bo s'ha anul·lat entre llegir-lo i reservar— o en un camí nou que
 * s'hagi oblidat de mirar-ho. Aquí es diu què vol dir cadascuna.
 *
 * Mòdul pur, sense `server-only`: el fan servir les reserves i la llista
 * d'espera, i el que diu ha de ser el mateix als dos llocs.
 */
export const BONO_REJECTIONS = [
  "no_sessions",
  "bono_not_found",
  "bono_other_client",
  "bono_other_service",
  "bono_not_usable",
  "bono_expired",
] as const;
export type BonoRejection = (typeof BONO_REJECTIONS)[number];

/**
 * Si el motiu és del BO (i no de la franja). A la llista d'espera, un motiu del
 * bo és cosa d'aquell candidat i el següent de la cua encara pot entrar;
 * 'taken' i 'full' són de la franja i ja no cal seguir provant.
 */
export function isBonoRejection(reason: unknown): reason is BonoRejection {
  return typeof reason === "string" && (BONO_REJECTIONS as readonly string[]).includes(reason);
}

/** El que llegeix l'equip (en català, com tota la seva àrea). */
export function bonoRejectionMessage(reason: BonoRejection, expiresAt?: string | null): string {
  switch (reason) {
    case "no_sessions":
      return "Aquest bo no té sessions disponibles.";
    case "bono_not_found":
      return "Bo no trobat.";
    case "bono_other_client":
      return "Aquest bo és d'un altre client.";
    case "bono_other_service":
      return "Aquest bo és d'un altre servei.";
    case "bono_not_usable":
      // Els dos textos d'`assertBonoUsable`: diu el mateix, vingui d'on vingui.
      return "Aquest bo ja no es pot fer servir.";
    case "bono_expired":
      return expiresAt
        ? `Aquest bo va caducar el ${formatDate(expiresAt)}: ja no es pot fer servir.`
        : "Aquest bo ha caducat: ja no es pot fer servir.";
  }
}

/**
 * El bo que s'havia de gastar ja no val (motius `bono_*`). L'àrea del client
 * el tradueix amb el codi `bonoUnusable` (ca/es/en); el missatge és el de
 * l'equip, per als registres.
 */
export class BonoUnusableError extends Error {
  constructor(public readonly reason: BonoRejection, expiresAt?: string | null) {
    super(bonoRejectionMessage(reason, expiresAt));
    this.name = "BonoUnusableError";
  }
}
