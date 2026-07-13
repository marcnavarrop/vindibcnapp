import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import {
  availableHoursForDate,
  localDateStr,
  type AvailabilityRuleLite,
  type TrainerRuleLite,
} from "@/lib/availability-slots";
import type { ServiceType } from "@/types/database";

export type AvailabilityRule = {
  id: string;
  trainerId: string;
  weekday: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  validFrom: string; // YYYY-MM-DD
  validUntil: string | null;
  serviceTypes: ServiceType[];
};

const hhmm = (t: string) => t.slice(0, 5);
const toHour = (t: string) => parseInt(t.slice(0, 2), 10);

function toLite(r: {
  weekday: number;
  start_time: string;
  end_time: string;
  valid_from: string;
  valid_until: string | null;
  service_types: ServiceType[];
}): AvailabilityRuleLite {
  return {
    weekday: r.weekday,
    startHour: toHour(r.start_time),
    endHour: toHour(r.end_time),
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    serviceTypes: r.service_types ?? [],
  };
}

/** Reglas de disponibilidad de un entrenador (para la UI de gestión). */
export async function listAvailabilityRules(
  trainerId: string,
): Promise<AvailabilityRule[]> {
  if (USE_MOCK) {
    return getStore()
      .availability_rules.filter((r) => r.trainer_id === trainerId)
      .sort(
        (a, b) =>
          a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
      )
      .map((r) => ({
        id: r.id,
        trainerId: r.trainer_id,
        weekday: r.weekday,
        startTime: hhmm(r.start_time),
        endTime: hhmm(r.end_time),
        validFrom: r.valid_from,
        validUntil: r.valid_until,
        serviceTypes: r.service_types ?? [],
      }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_rules")
    .select(
      "id, trainer_id, weekday, start_time, end_time, valid_from, valid_until, service_types",
    )
    .eq("trainer_id", trainerId)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    trainerId: r.trainer_id,
    weekday: r.weekday,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    serviceTypes: r.service_types ?? [],
  }));
}

/** Versión "lite" (horas numéricas) para el calendario del cliente. */
export async function listAvailabilityLite(
  trainerId: string,
): Promise<AvailabilityRuleLite[]> {
  if (USE_MOCK) {
    return getStore()
      .availability_rules.filter((r) => r.trainer_id === trainerId)
      .map(toLite);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_rules")
    .select("weekday, start_time, end_time, valid_from, valid_until, service_types")
    .eq("trainer_id", trainerId);
  if (error) throw error;
  return (data ?? []).map(toLite);
}

/** Todas las reglas de TODOS los profesionales (para el calendario global). */
export async function listAllTrainerRulesLite(): Promise<TrainerRuleLite[]> {
  if (USE_MOCK) {
    return getStore().availability_rules.map((r) => ({
      trainerId: r.trainer_id,
      ...toLite(r),
    }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_rules")
    .select(
      "trainer_id, weekday, start_time, end_time, valid_from, valid_until, service_types",
    );
  if (error) throw error;
  return (data ?? []).map((r) => ({ trainerId: r.trainer_id, ...toLite(r) }));
}

export type CreateAvailabilityInput = {
  trainerId: string;
  weekdays: number[];
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  validFrom: string; // YYYY-MM-DD
  validUntil: string | null;
  serviceTypes: ServiceType[];
};

/** Crea una regla por cada día marcado (alta ágil). */
export async function createAvailabilityRules(
  input: CreateAvailabilityInput,
): Promise<void> {
  if (input.weekdays.length === 0) return;

  if (USE_MOCK) {
    const store = getStore();
    const now = new Date().toISOString();
    for (const weekday of input.weekdays) {
      store.availability_rules.push({
        id: crypto.randomUUID(),
        trainer_id: input.trainerId,
        weekday,
        start_time: input.startTime,
        end_time: input.endTime,
        valid_from: input.validFrom,
        valid_until: input.validUntil,
        service_types: input.serviceTypes,
        created_at: now,
      });
    }
    saveStore(store);
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("availability_rules").insert(
    input.weekdays.map((weekday) => ({
      trainer_id: input.trainerId,
      weekday,
      start_time: input.startTime,
      end_time: input.endTime,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      service_types: input.serviceTypes,
    })),
  );
  if (error) throw error;
}

export type UpdateAvailabilityInput = {
  startTime: string;
  endTime: string;
  validFrom: string;
  validUntil: string | null;
  serviceTypes: ServiceType[];
};

/** Edita una regla individual. */
export async function updateAvailabilityRule(
  id: string,
  input: UpdateAvailabilityInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const r = store.availability_rules.find((x) => x.id === id);
    if (!r) throw new Error("Regla no trobada.");
    r.start_time = input.startTime;
    r.end_time = input.endTime;
    r.valid_from = input.validFrom;
    r.valid_until = input.validUntil;
    r.service_types = input.serviceTypes;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_rules")
    .update({
      start_time: input.startTime,
      end_time: input.endTime,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      service_types: input.serviceTypes,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Elimina una regla individual. */
export async function deleteAvailabilityRule(id: string): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    store.availability_rules = store.availability_rules.filter(
      (r) => r.id !== id,
    );
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_rules")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Franjas horarias (horas enteras) en las que el entrenador tiene
 * disponibilidad activa en una fecha concreta.
 */
export async function getAvailableSlots(
  trainerId: string,
  date: Date,
): Promise<number[]> {
  const rules = await listAvailabilityLite(trainerId);
  return availableHoursForDate(rules, date);
}

/** Helper de fecha local reexportado por comodidad. */
export { localDateStr };
