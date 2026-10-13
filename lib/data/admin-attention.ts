import "server-only";
import {
  pendingTrialAttention,
  type TrialAttentionItem,
} from "@/lib/data/trial-attention";
import { listVouchersPendingPayment } from "@/lib/data/gift-vouchers";
import { listReferralRewardsAdmin } from "@/lib/data/referral";
import { getCenterSettings } from "@/lib/data/center-settings";
import { USE_MOCK } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getStore } from "@/lib/mock/store";
import { centerToday } from "@/lib/center-time";

/**
 * El que espera resposta de l'administració, avui.
 *
 * Quatre coses, i cap més. El criteri per entrar-hi és que NO respondre tingui
 * un cost: una prova pendent bloqueja una franja fins que caduca, un val
 * pendent de cobrament no es pot bescanviar encara que ja s'hagi regalat, una
 * recompensa de referit és un descompte promès que no s'ha aplicat, i un client
 * sense entrenador amb un bo d'entrenament (individual o parelles) l'ha pagat o
 * l'ha de pagar i no el pot reservar fins que se n'hi assigni un. Aquest últim
 * el pot comprar sol (Stripe o «pagar al centre», decisió d'en Marc de
 * deixar-ho així) i cap altre avís no ho diu.
 *
 * En queden fora els tiquets de suport —l'admin els OBRE, no els respon: van
 * cap a qui desenvolupa— i els bons pendents de cobrament, que ja són una de
 * les sis mètriques i tenen la seva pròpia acció ràpida. Repetir-los aquí els
 * convertiria en soroll.
 *
 * Les quatre lectures són PURES. Les llistes generals de proves i de vals fan
 * una escombrada peresosa —marquen com a caducat el que ja ho està— i això
 * està bé a les seves pàgines, però aquí feia que obrir l'inici escrivís a la
 * base. Una pantalla que es mira desenes de cops al dia no ha de tenir
 * efectes secundaris.
 */
export type AdminAttention = {
  trials: TrialAttentionItem[];
  vouchers: { id: string; code: string; buyerName: string; price: number }[];
  referrals: number;
  /** Clients sense entrenador amb un bo d'entrenament viu (actiu o pendent). */
  trainingWithoutTrainer: number;
  /** No hi ha res de res: qui ho pinta pot amagar la secció sencera. */
  empty: boolean;
};

export async function getAdminAttention(): Promise<AdminAttention> {
  const settings = await getCenterSettings();

  // Les recompenses només es demanen si el programa està engegat: amb el
  // programa apagat, una llista de descomptes pendents no vol dir res.
  //
  // I les proves, només si el mòdul hi és. Amb el mòdul apagat no en poden
  // entrar de noves, però les que van quedar pendents seguien sortint aquí amb
  // el seu compte enrere i un botó "Revisar" cap a `/admin/prova`, que ja
  // respon 404: un avís urgent que no porta enlloc. Deixen de bloquejar
  // franges soles quan caduquen, com sempre.
  const [trialsRaw, vouchersRaw, rewardsRaw, trainingWithoutTrainer] = await Promise.all([
    settings.modules.sessionsProva
      ? pendingTrialAttention()
      : Promise.resolve([]),
    listVouchersPendingPayment(),
    settings.referralProgramActive
      ? listReferralRewardsAdmin()
      : Promise.resolve([]),
    countTrainingWithoutTrainer(),
  ]);

  // Les proves ja arriben preparades; els vals, filtrats i ordenats.
  const trials = trialsRaw;

  const vouchers = vouchersRaw.map((v) => ({
    id: v.id,
    code: v.code,
    buyerName: v.buyerName,
    price: v.price,
  }));

  const referrals = rewardsRaw.filter((r) => r.status === "pending").length;

  return {
    trials,
    vouchers,
    referrals,
    trainingWithoutTrainer,
    empty:
      trials.length === 0 &&
      vouchers.length === 0 &&
      referrals === 0 &&
      trainingWithoutTrainer === 0,
  };
}

/** Els bons que el client sense entrenador no pot reservar: individual i parelles. */
const ASSIGNED_ONLY = ["ep_individual", "ep_parejas"] as const;

/**
 * Quants CLIENTS (no bons) no tenen entrenador assignat i tenen un bo
 * d'entrenament viu: actiu o pendent de pagament, i sense caducar.
 *
 * Una lectura pura i acotada: com a molt 1000 bons d'aquest tipus, que en un
 * centre com aquest no s'acosta ni de lluny. Si mai falla, l'inici es pinta
 * igual i aquesta fila no hi surt (0): no ha de tombar la pantalla.
 */
async function countTrainingWithoutTrainer(): Promise<number> {
  const today = centerToday();
  const live = (b: { status: string; expires_at: string | null }) =>
    (b.status === "active" || b.status === "pending_payment") &&
    (!b.expires_at || b.expires_at >= today);
  if (USE_MOCK) {
    const s = getStore();
    const sense = new Set(s.clients.filter((c) => !c.assigned_trainer_id).map((c) => c.id));
    return new Set(
      s.bonos
        .filter((b) => sense.has(b.client_id) && (ASSIGNED_ONLY as readonly string[]).includes(b.service_type) && live(b))
        .map((b) => b.client_id),
    ).size;
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bonos")
      .select("client_id, status, expires_at, client:clients!inner(assigned_trainer_id)")
      .in("service_type", [...ASSIGNED_ONLY])
      .in("status", ["active", "pending_payment"])
      .is("client.assigned_trainer_id", null)
      .limit(1000);
    if (error) throw error;
    return new Set((data ?? []).filter(live).map((b) => b.client_id)).size;
  } catch (e) {
    console.error("[inici] clients sense entrenador amb bo d'entrenament:", e);
    return 0;
  }
}
