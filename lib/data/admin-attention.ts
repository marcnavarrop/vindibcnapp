import "server-only";
import {
  pendingTrialAttention,
  type TrialAttentionItem,
} from "@/lib/data/trial-attention";
import { listVouchersPendingPayment } from "@/lib/data/gift-vouchers";
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
 *
 * Les tres lectures són PURES. Les llistes generals de proves i de vals fan
 * una escombrada peresosa —marquen com a caducat el que ja ho està— i això
 * està bé a les seves pàgines, però aquí feia que obrir l'inici escrivís a la
 * base. Una pantalla que es mira desenes de cops al dia no ha de tenir
 * efectes secundaris.
 */
export type AdminAttention = {
  trials: TrialAttentionItem[];
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
    pendingTrialAttention(),
    listVouchersPendingPayment(),
    settings.referralProgramActive
      ? listReferralRewardsAdmin()
      : Promise.resolve([]),
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
    empty: trials.length === 0 && vouchers.length === 0 && referrals === 0,
  };
}
