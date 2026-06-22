import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore, saveStore } from "@/lib/mock/store";
import type { ServiceType } from "@/types/database";

export type Service = {
  id: string;
  serviceType: ServiceType;
  name: string;
  price: number;
  defaultSessions: number;
  active: boolean;
};

export type ServiceInput = {
  serviceType: ServiceType;
  name: string;
  price: number;
  defaultSessions: number;
  active: boolean;
};

type Row = {
  id: string;
  service_type: ServiceType;
  name: string;
  price: number;
  default_sessions: number;
  active: boolean;
};

function toService(r: Row): Service {
  return {
    id: r.id,
    serviceType: r.service_type,
    name: r.name,
    price: r.price,
    defaultSessions: r.default_sessions,
    active: r.active,
  };
}

/** Todo el catálogo (incluidos inactivos), para la pantalla de gestión. */
export async function listServices(): Promise<Service[]> {
  if (USE_MOCK) return getStore().services.map(toService);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, service_type, name, price, default_sessions, active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toService);
}

/** Solo servicios activos, para los desplegables (alta de bono). */
export async function listActiveServices(): Promise<Service[]> {
  return (await listServices()).filter((s) => s.active);
}

export async function getService(id: string): Promise<Service | null> {
  if (USE_MOCK) {
    const s = getStore().services.find((x) => x.id === id);
    return s ? toService(s) : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, service_type, name, price, default_sessions, active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toService(data) : null;
}

export async function createService(input: ServiceInput): Promise<string> {
  if (USE_MOCK) {
    const store = getStore();
    const id = crypto.randomUUID();
    store.services.push({
      id,
      service_type: input.serviceType,
      name: input.name,
      price: input.price,
      default_sessions: input.defaultSessions,
      active: input.active,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
    return id;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      service_type: input.serviceType,
      name: input.name,
      price: input.price,
      default_sessions: input.defaultSessions,
      active: input.active,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateService(
  id: string,
  input: ServiceInput,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const s = store.services.find((x) => x.id === id);
    if (!s) throw new Error("Servei no trobat.");
    s.service_type = input.serviceType;
    s.name = input.name;
    s.price = input.price;
    s.default_sessions = input.defaultSessions;
    s.active = input.active;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      service_type: input.serviceType,
      name: input.name,
      price: input.price,
      default_sessions: input.defaultSessions,
      active: input.active,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Activa/desactiva un servicio (sin borrarlo, para no perder histórico). */
export async function setServiceActive(
  id: string,
  active: boolean,
): Promise<void> {
  if (USE_MOCK) {
    const store = getStore();
    const s = store.services.find((x) => x.id === id);
    if (s) s.active = active;
    saveStore(store);
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}
