import type { PaymentMethod } from "@/types/database";

/**
 * COM ES COBRA AL TAULELL: en efectiu o amb la targeta del TPV.
 *
 * No és un tercer mètode: a la base, una targeta del TPV és un `card` sense
 * `stripe_payment_id`, el mateix que ja anotaven «Nou pagament» i l'opció
 * «Targeta» de «Nou bo». La de Stripe és la que porta l'identificador.
 *
 * Mòdul pur, sense `server-only`: el fan servir el diàleg de cobrar (per pintar
 * les opcions) i les accions de servidor (per validar el que arriba).
 */
export const COUNTER_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Efectiu" },
  { value: "card", label: "Targeta (TPV)" },
];

/**
 * El mètode d'un formulari de cobrament. Sense camp, efectiu: és el que feien
 * els botons fins ara i el que enviaria una pestanya oberta d'abans. Amb un
 * valor que no és cap dels dos, `null`, i l'acció no cobra.
 */
export function parseCounterMethod(v: FormDataEntryValue | null): PaymentMethod | null {
  if (v === null || v === "") return "cash";
  return v === "cash" || v === "card" ? v : null;
}

export const BAD_METHOD = "Mètode de cobrament no vàlid. No s'ha cobrat res.";
