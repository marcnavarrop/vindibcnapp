import "server-only";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStore, saveStore } from "@/lib/mock/store";
import { SERVICE_COLORS, SERVICE_TYPES } from "@/lib/labels";
import { proColor, nextAvailableProColor } from "@/lib/pro-colors";
import type { ColorPalette } from "@/lib/colors";
import type { ServiceType } from "@/types/database";

/** Hex de 6 dígits, igual que la restricció de la taula. */
const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(v: string): boolean {
  return HEX.test(v);
}

/**
 * Paleta sencera del centre, resolta.
 *
 * Es llegeix amb el client de servei i no amb el de sessió pel mateix motiu
 * que la configuració del centre: la RLS obre el SELECT als autenticats, i
 * qualsevol pantalla que es pinti sense sessió es quedaria sense colors i
 * cauria als per defecte sense dir-ho. Un color no és cap dada sensible.
 *
 * Torna els mapes JA COMPLETS —tots els professionals i els quatre serveis—
 * perquè qui la fa servir només hagi d'indexar: la decisió "desat o per
 * defecte" es pren aquí una sola vegada i no es pot desviar entre pantalles.
 */
export async function getColorPalette(): Promise<ColorPalette> {
  if (USE_MOCK) {
    const store = getStore();
    const pros: Record<string, string> = {};
    for (const p of store.profiles.filter((x) => x.role === "trainer"))
      pros[p.id] =
        store.professional_colors.find((c) => c.trainer_id === p.id)?.color ??
        proColor(p.id);

    const services = { ...SERVICE_COLORS };
    for (const row of store.service_type_colors)
      services[row.service_type] = row.color;

    return { pros, services };
  }

  const admin = createAdminClient();
  const [pro, svc, tra] = await Promise.all([
    admin.from("professional_colors").select("trainer_id, color"),
    admin.from("service_type_colors").select("service_type, color"),
    admin.from("profiles").select("id").eq("role", "trainer"),
  ]);

  const saved = new Map((pro.data ?? []).map((r) => [r.trainer_id, r.color]));
  const pros: Record<string, string> = {};
  for (const t of tra.data ?? []) pros[t.id] = saved.get(t.id) ?? proColor(t.id);

  // Sobre els del codi: si la llavor de la migració no hi fos, la pantalla
  // segueix pintant-se amb els colors d'abans en comptes de quedar-se buida.
  const services = { ...SERVICE_COLORS };
  for (const row of svc.data ?? []) services[row.service_type] = row.color;

  return { pros, services };
}

/**
 * Assigna color a un professional acabat de crear.
 *
 * Best-effort a propòsit: si això falla, l'alta no s'ha de trencar per un
 * color, i `getColorPalette` ja li'n dona un de per defecte igualment.
 */
export async function assignInitialProColor(trainerId: string): Promise<void> {
  try {
    if (USE_MOCK) {
      const store = getStore();
      if (store.professional_colors.some((c) => c.trainer_id === trainerId))
        return;
      store.professional_colors.push({
        trainer_id: trainerId,
        color: nextAvailableProColor(
          store.professional_colors.map((c) => c.color),
        ),
        updated_at: new Date().toISOString(),
      });
      saveStore(store);
      return;
    }

    const admin = createAdminClient();
    const { data } = await admin.from("professional_colors").select("color");
    await admin.from("professional_colors").insert({
      trainer_id: trainerId,
      color: nextAvailableProColor((data ?? []).map((r) => r.color)),
    });
  } catch {
    // Silenci volgut: veure el comentari de dalt.
  }
}

export async function setProfessionalColor(
  trainerId: string,
  color: string,
): Promise<void> {
  if (!isHexColor(color)) throw new Error("El color ha de ser un hex #rrggbb.");

  if (USE_MOCK) {
    const store = getStore();
    const row = store.professional_colors.find(
      (c) => c.trainer_id === trainerId,
    );
    if (row) row.color = color;
    else
      store.professional_colors.push({
        trainer_id: trainerId,
        color,
        updated_at: new Date().toISOString(),
      });
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("professional_colors")
    .upsert(
      { trainer_id: trainerId, color, updated_at: new Date().toISOString() },
      { onConflict: "trainer_id" },
    );
  if (error) throw error;
}

export async function setServiceTypeColor(
  serviceType: ServiceType,
  color: string,
): Promise<void> {
  if (!isHexColor(color)) throw new Error("El color ha de ser un hex #rrggbb.");
  if (!SERVICE_TYPES.includes(serviceType))
    throw new Error("Tipus de servei desconegut.");

  if (USE_MOCK) {
    const store = getStore();
    const row = store.service_type_colors.find(
      (c) => c.service_type === serviceType,
    );
    if (row) row.color = color;
    else
      store.service_type_colors.push({
        service_type: serviceType,
        color,
        updated_at: new Date().toISOString(),
      });
    saveStore(store);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("service_type_colors")
    .upsert(
      { service_type: serviceType, color, updated_at: new Date().toISOString() },
      { onConflict: "service_type" },
    );
  if (error) throw error;
}
