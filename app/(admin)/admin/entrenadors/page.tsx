import { Avatar } from "@/components/ui/avatar";
import { TAP, TAP_SURFACE } from "@/lib/utils";
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

type Trainer = Awaited<ReturnType<typeof listTrainersDetailed>>[number];

export default async function EntrenadorsPage() {
  const [trainers, palette] = await Promise.all([
    listTrainersDetailed(),
    getColorPalette(),
  ]);
  // Les signed URLs es demanen totes d'un cop: una per fila serien N viatges.
  const avatars = await avatarUrls(trainers.map((t) => t.avatarPath));

  return (
    <>
      <main className="mx-auto max-w-5xl p-6">
        <GroupTabs tabs={TABS} />
        {/* `flex-wrap`: a 375 px el títol i «+ Nou professional» no hi cabien
            junts i el botó sortia del marge; ara baixa a sota. */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div>
            <h1 className="text-2xl text-brand-dark">Professionals</h1>
          </div>
          <Link
            href="/admin/entrenadors/new"
            className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
          >
            + Nou professional
          </Link>
        </div>

        {/* Al mòbil, targetes; a partir de 768 px, la taula. */}
        <ul className="flex flex-col gap-2 md:hidden" data-testid="pros-cards">
          {trainers.map((t) => (
            <ProCard
              key={t.id}
              t={t}
              avatar={
                <Avatar
                  name={t.fullName}
                  email={t.email}
                  url={avatars.get(t.avatarPath ?? "") ?? null}
                  size={32}
                  color={colorOfPro(palette, t.id)}
                />
              }
            />
          ))}
          {trainers.length === 0 && (
            <li className="rounded-2xl border border-brand-border bg-white px-4 py-8 text-center text-sm text-brand-muted">
              Encara no hi ha professionals. Crea&apos;n un de nou.
            </li>
          )}
        </ul>

        <div className="hidden overflow-x-auto rounded-2xl border border-brand-border bg-white md:block">
          <table className="w-full min-w-[40rem] text-left text-sm" data-testid="pros-table">
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
                  className={`border-b border-brand-border last:border-0 hover:bg-brand-bg/50 active:bg-brand-bg ${TAP_SURFACE}`}
                >
                  <CellLink href={`/admin/entrenadors/${t.id}/edit`} first>
                    <span className="flex items-center gap-2.5 font-bold text-brand-dark">
                      <Avatar
                        name={t.fullName}
                        email={t.email}
                        url={avatars.get(t.avatarPath ?? "") ?? null}
                        size={32}
                        color={colorOfPro(palette, t.id)}
                      />
                      {t.fullName}
                    </span>
                  </CellLink>
                  <CellLink href={`/admin/entrenadors/${t.id}/edit`}>
                    <span className="text-brand-muted">{t.email}</span>
                  </CellLink>
                  <CellLink href={`/admin/entrenadors/${t.id}/edit`}>
                    <SpecialtyBadge t={t} />
                  </CellLink>
                  {/* Aquestes dues queden fora de l'enllaç de la fila: el
                      recompte porta als seus clients i l'última té botons
                      propis. A dins, tocar-los obriria la fitxa i prou. */}
                  <td className="px-4 py-3">
                    {t.clientCount > 0 ? (
                      <Link
                        href={`/admin/clients?trainer=${t.id}`}
                        title={`Veure els clients de ${t.fullName}`}
                        className={`font-bold text-brand-purple underline decoration-brand-purple/30 underline-offset-2 hover:text-brand-orange hover:decoration-brand-orange/40 ${TAP}`}
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
                        className={`text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-orange ${TAP}`}
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

function SpecialtyBadge({ t }: { t: Trainer }) {
  return t.specialty ? (
    <Badge tone={t.specialty === "fisioterapeuta" ? "info" : "success"} icon={null}>{SPECIALTY_LABELS[t.specialty]}</Badge>
  ) : (
    <span className="text-brand-muted italic">Sense especialitat</span>
  );
}

/**
 * UN PROFESSIONAL, AL MÒBIL. Com la targeta de client: tota la targeta obre
 * «Editar» (l'enllaç del nom s'estén per sobre), i el recompte de clients,
 * «Reenviar invitació» i «Editar» van per sobre amb `relative z-10`.
 */
function ProCard({ t, avatar }: { t: Trainer; avatar: React.ReactNode }) {
  const edit = `/admin/entrenadors/${t.id}/edit`;
  return (
    <li
      className="relative flex flex-col gap-1 rounded-2xl border border-brand-border bg-white px-3.5 py-3 active:bg-brand-bg"
      data-testid="pro-card"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          {avatar}
          <Link
            href={edit}
            className="min-w-0 truncate font-bold text-brand-dark after:absolute after:inset-0 after:rounded-2xl after:content-['']"
          >
            {t.fullName}
          </Link>
        </span>
        <span className="shrink-0 text-xs">
          <SpecialtyBadge t={t} />
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 text-[13px] text-brand-muted">
        <span className="min-w-0 truncate">{t.email}</span>
        <ResendInviteButton profileId={t.id} inCard />
      </div>
      <div className="flex items-center justify-between gap-3 text-[13px] text-brand-muted">
        {t.clientCount > 0 ? (
          <Link
            href={`/admin/clients?trainer=${t.id}`}
            className={`relative z-10 -my-3 inline-flex h-11 items-center font-bold text-brand-purple underline decoration-brand-purple/30 underline-offset-2 ${TAP}`}
          >
            {t.clientCount === 1 ? "1 client" : `${t.clientCount} clients`}
          </Link>
        ) : (
          <span>Cap client</span>
        )}
        <Link
          href={edit}
          tabIndex={-1}
          className={`relative z-10 -my-3 inline-flex h-11 items-center text-xs font-bold tracking-wide text-brand-purple uppercase ${TAP}`}
        >
          Editar
        </Link>
      </div>
    </li>
  );
}

/** Vegeu `CellLink` a `components/clients-table.tsx`: mateixa raó, mateixa forma. */
function CellLink({
  href,
  first,
  children,
}: {
  href: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <td className="p-0">
      <Link
        href={href}
        tabIndex={first ? undefined : -1}
        className="block px-4 py-3"
      >
        {children}
      </Link>
    </td>
  );
}
