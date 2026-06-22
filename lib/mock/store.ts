import "server-only";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  seedProfiles,
  seedClients,
  seedBonos,
  seedReservations,
  seedPayments,
  seedServices,
  seedExercises,
  seedMeasurements,
} from "./seed";
import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];

export type Store = {
  profiles: Tables["profiles"]["Row"][];
  clients: Tables["clients"]["Row"][];
  bonos: Tables["bonos"]["Row"][];
  reservations: Tables["reservations"]["Row"][];
  payments: Tables["payments"]["Row"][];
  services: Tables["services"]["Row"][];
  exercises: Tables["exercises"]["Row"][];
  measurements: Tables["measurements"]["Row"][];
};

/**
 * Persistencia del modo simulación.
 *
 * El estado a nivel de módulo NO sobrevive entre peticiones en el App Router,
 * así que guardamos el dataset en un fichero JSON temporal. Persiste en local
 * (mientras el servidor viva) y en una instancia caliente de Vercel. Es
 * efímero a propósito: en cuanto conectes Supabase, nada de esto se usa.
 */
const FILE = path.join(os.tmpdir(), "vindibcn-mock.json");

function fromSeed(): Store {
  return {
    profiles: structuredClone(seedProfiles),
    clients: structuredClone(seedClients),
    bonos: structuredClone(seedBonos),
    reservations: structuredClone(seedReservations),
    payments: structuredClone(seedPayments),
    services: structuredClone(seedServices),
    exercises: structuredClone(seedExercises),
    measurements: structuredClone(seedMeasurements),
  };
}

export function getStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
  } catch {
    const seeded = fromSeed();
    saveStore(seeded);
    return seeded;
  }
}

export function saveStore(store: Store): void {
  try {
    fs.writeFileSync(FILE, JSON.stringify(store));
  } catch {
    // Filesystem de solo lectura (p. ej. build): se ignora.
  }
}
