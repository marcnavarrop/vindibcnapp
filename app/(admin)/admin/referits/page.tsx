import { listReferralRewardsAdmin } from "@/lib/data/referral";
import { getCenterSettings } from "@/lib/data/center-settings";
import { formatDate } from "@/lib/labels";
import { GroupTabs } from "@/components/ui/group-tabs";
import { BONS_TABS } from "@/lib/admin-tabs";
import type { ReferralRewardStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ReferralRewardStatus, string> = {
  pending: "Pendent",
  used: "Usada",
  expired: "Caducada",
};

const STATUS_COLOR: Record<ReferralRewardStatus, string> = {
  pending: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  used: "bg-brand-bg text-brand-muted ring-1 ring-brand-border",
  expired: "bg-red-50 text-red-600 ring-1 ring-red-600/20",
};

export default async function AdminReferitsPage() {
  const [rewards, centerSettings] = await Promise.all([
    listReferralRewardsAdmin(),
    getCenterSettings(),
  ]);

  const pending = rewards.filter((r) => r.status === "pending").length;
  const used = rewards.filter((r) => r.status === "used").length;

  return (
    <>
      <GroupTabs tabs={BONS_TABS} />
      <main className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl text-brand-dark">Referits</h1>
            <p className="text-sm text-brand-muted">
              Recompenses generades pel programa de referits.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                centerSettings.referralProgramActive
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                  : "bg-brand-bg text-brand-muted ring-1 ring-brand-border"
              }`}
            >
              {centerSettings.referralProgramActive
                ? `Actiu · ${centerSettings.referralDiscountPercent}% de descompte`
                : "Programa inactiu"}
            </span>
          </div>
        </div>

        {/* Resum */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-brand-border bg-white p-4">
            <p className="text-2xl font-bold text-brand-dark">
              {rewards.length}
            </p>
            <p className="text-xs text-brand-muted">Total recompenses</p>
          </div>
          <div className="rounded-2xl border border-brand-border bg-white p-4">
            <p className="text-2xl font-bold text-emerald-600">{pending}</p>
            <p className="text-xs text-brand-muted">Pendents d&apos;usar</p>
          </div>
          <div className="rounded-2xl border border-brand-border bg-white p-4">
            <p className="text-2xl font-bold text-brand-dark">{used}</p>
            <p className="text-xs text-brand-muted">Ja usades</p>
          </div>
        </div>

        {rewards.length === 0 ? (
          <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
            Encara no s&apos;han generat recompenses.{" "}
            {!centerSettings.referralProgramActive &&
              "Activa el programa des de Configuració → Centre."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-left text-xs font-bold text-brand-muted uppercase">
                  <th className="px-4 py-3">Qui refereix</th>
                  <th className="px-4 py-3">Nou client</th>
                  <th className="px-4 py-3">Beneficiari</th>
                  <th className="px-4 py-3">%</th>
                  <th className="px-4 py-3">Estat</th>
                  <th className="px-4 py-3">Creat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {/* Sense `hover:`: aquestes files no porten enlloc.
                    El fons que s'encenia en passar-hi per sobre prometia una
                    fitxa que no existeix —de recompenses només n'hi ha la
                    llista— i la consulta duu noms escrits, no els
                    identificadors de les persones. Millor no convidar a un
                    clic que no farà res. */}
                {rewards.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-brand-dark">
                      {r.referrerName}
                    </td>
                    <td className="px-4 py-3 text-brand-charcoal">
                      {r.refereeName}
                    </td>
                    <td className="px-4 py-3 text-brand-charcoal">
                      {r.beneficiaryName}
                      {r.beneficiaryName === r.refereeName && (
                        <span className="ml-1.5 rounded-full bg-brand-purple/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-purple">
                          referit
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-brand-dark">
                      {r.discountPercent}%
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-muted">
                      {formatDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
