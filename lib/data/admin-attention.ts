import "server-only";
import { listTrialBookings } from "@/lib/data/trial-bookings";
import { listGiftVouchersAdmin } from "@/lib/data/gift-vouchers";
import { listReferralRewardsAdmin } from "@/lib/data/referral";
import { getCenterSettings } from "@/lib/data/center-settings";

/**
 * El que espera resposta de l'administració, avui.
 *
 * Tres coses, i cap més. El criteri per entrar-hi és que NO respondre tingui
 * un cost: una prova pendent bloqueja una franja fins que caduca, un val
 * pendent de cobrament no es pot bescanviar encara que ja s'hagi regalat, i
 * una recompensa de referit és un descompte promès que no s'ha aplicat.
 *
 * En queden fora els tiquets de suport —l'admin els OBRE, no els respon: van
 * cap a qui desenvolupa— i els bons pendents de cobrament, que ja són una de
 * les sis mètriques i tenen la seva pròpia acció ràpida. Repetir-los aquí els
 * convertiria en soroll.
 */
export type AdminAttention = {
  trials: {
    id: string;
    name: string;
    scheduledAt: string;
    trainerName: string | null;
    /** Hores que falten perquè la sol·licitud caduqui (mai negatiu). */
    hoursLeft: number;
  }[];
  vouchers: { id: string; code: string; buyerName: string; price: number }[];
  referrals: number;
  /** Cap de les tres coses té res: qui ho pinta pot amagar la secció sencera. */
  empty: boolean;
};

export async function getAdminAttention(): Promise<AdminAttention> {
  const settings = await getCenterSettings();

  // Les recompenses només es demanen si el programa està engegat: amb el
  // programa apagat, una llista de descomptes pendents no vol dir res.
  const [trialsRaw, vouchersRaw, rewardsRaw] = await Promise.all([
    listTrialBookings(),
    listGiftVouchersAdmin(),
    settings.referralProgramActive
      ? listReferralRewardsAdmin()
      : Promise.resolve([]),
  ]);

  const now = Date.now();

  /*
   * Les proves caducades no hi surten.
   *
   * `listTrialBookings` ja escombra les que han passat de termini, però entre
   * l'escombrada i aquesta lectura pot haver-n'hi alguna: es filtra igualment
   * per no demanar acció sobre una franja que ja s'ha alliberat sola.
   */
  const trials = trialsRaw
    .filter((t) => t.status === "pending" && new Date(t.expiresAt).getTime() > now)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
    .map((t) => ({
      id: t.id,
      name: t.fullName,
      scheduledAt: t.scheduledAt,
      trainerName: t.trainerName,
      hoursLeft: Math.max(
        0,
        Math.floor((new Date(t.expiresAt).getTime() - now) / 3_600_000),
      ),
    }));

  const vouchers = vouchersRaw
    .filter((v) => v.status === "pending_payment")
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))
    .map((v) => ({
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
    empty: trials.length === 0 && vouchers.length === 0 && referrals === 0,
  };
}
