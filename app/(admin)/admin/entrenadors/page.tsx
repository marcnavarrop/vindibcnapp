import { Avatar } from "@/components/ui/avatar";
import { TAP } from "@/lib/utils";
import { avatarUrls } from "@/lib/data/avatars";
import { getColorPalette } from "@/lib/data/colors";
import { colorOfPro } from "@/lib/colors";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listTrainersDetailed } from "@/lib/data/trainers";
import { GroupTabs } from "@/components/ui/group-tabs";

const TABS = [
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/entrenadors", label: "Professionals" },
];
import { SPECIALTY_LABELS } from "@/lib/labels";
import { ResendInviteButton } from "@/components/resend-invite-button";

export const dynamic = "force-dynamic";

export default async function EntrenadorsPage() {
  const [trainers, palette] = await Promise.all([
    listTrainersDetailed(),
    getColorPalette(),
  ]);
  // Les signed URLs es demanen totes d'un cop: una per fila serien N viatges.
  const avatars = await avatarUrls(trainers.map((t) => t.avatarPath));

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
            >
              ← Tornar
            </Link>
            <h1 className="mt-1 text-2xl text-brand-dark">Professionals</h1>
          </div>
          <Link
            href="/admin/entrenadors/new"
            className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            + Nou professional
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-brand-border bg-brand-bg">
              <tr className="text-xs tracking-wide text-brand-muted uppercase">
                <th className="px-4 py-3 font-bold">Nom</th>
                <th className="px-4 py-3 font-bold">Correu</th>
                <th className="px-4 py-3 font-bold">Especialitat</th>
                <th className="px-4 py-3 font-bold">Clients</th>
                <th className="px-4 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-brand-border last:border-0 hover:bg-brand-bg/50"
                >
                  <td className="px-4 py-3 font-bold text-brand-dark">
                    <span className="flex items-center gap-2.5">
                      <Avatar
                        name={t.fullName}
                        email={t.email}
                        url={avatars.get(t.avatarPath ?? "") ?? null}
                        size={32}
                        color={colorOfPro(palette, t.id)}
                      />
                      {t.fullName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brand-muted">{t.email}</td>
                  <td className="px-4 py-3">
                    {t.specialty ? (
                      <Badge
                        tone={
                          t.specialty === "fisioterapeuta" ? "info" : "success"
                        }
                      >
                        {SPECIALTY_LABELS[t.specialty]}
                      </Badge>
                    ) : (
                      <span className="text-brand-muted italic">
                        Sense especialitat
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.clientCount > 0 ? (
                      <Link
                        href={`/admin/clients?trainer=${t.id}`}
                        title={`Veure els clients de ${t.fullName}`}
                        className="font-bold text-brand-purple underline decoration-brand-purple/30 underline-offset-2 hover:text-brand-orange hover:decoration-brand-orange/40"
                      >
                        {t.clientCount}
                      </Link>
                    ) : (
                      <span className="font-bold text-brand-muted">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <ResendInviteButton profileId={t.id} />
                      <Link
                        href={`/admin/entrenadors/${t.id}/edit`}
                        className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange"
                      >
                        Editar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {trainers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-brand-muted"
                  >
                    Encara no hi ha professionals. Crea&apos;n un de nou.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
