import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listAnnouncements } from "@/lib/data/announcements";
import { listPollsForClient } from "@/lib/data/polls";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
import { getReferralStats } from "@/lib/data/referral";
import { avatarUrls } from "@/lib/data/avatars";
import {
  computeClientKpis,
  usableBonos,
  upcomingReservations,
  listTrainerCards,
} from "@/lib/data/client-dashboard";
import { CommunityBoard } from "@/components/community-board";
import { PollCard } from "@/components/poll-card";
import {
  KpiRow,
  QuickActions,
  ActiveBonos,
  UpcomingReservations,
  NextSessionCard,
} from "@/components/client/home-sections";
import { GiftCta, ReferralCta } from "@/components/client/growth-cards";
import { formatLongDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** Quantes reserves i quants anuncis caben a l'inici abans de "veure'ls tots". */
const MAX_UPCOMING = 3;

export default async function ClientHome() {
  const viewer = await getViewer();

  const [client, centerSettings, palette, trainers] = await Promise.all([
    viewer ? getClientByProfile(viewer.id) : Promise.resolve(null),
    getCenterSettings(),
    getColorPalette(),
    listTrainerCards(),
  ]);

  // La comunitat només es demana si el mòdul està engegat: si no, seria una
  // consulta per a una secció que no es pintarà. El mateix amb el codi de
  // referit, que només fa falta si el programa està actiu.
  const showCommunity = centerSettings.modules.comunitat;
  const showReferral = centerSettings.referralProgramActive;
  const [announcements, polls, referral] = await Promise.all([
    showCommunity ? listAnnouncements() : Promise.resolve([]),
    showCommunity && client
      ? listPollsForClient(client.id)
      : Promise.resolve([]),
    showReferral && viewer
      ? getReferralStats(viewer.id)
      : Promise.resolve(null),
  ]);

  const firstName = viewer?.fullName?.split(" ")[0] ?? "";

  if (!client) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <Header name={firstName} />
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          Encara no tens fitxa de client. Parla amb el centre per activar-la.
        </p>
      </main>
    );
  }

  const kpis = computeClientKpis(client);
  const bonos = usableBonos(client);
  const upcoming = upcomingReservations(client, new Date().toISOString());

  // El nom i la foto surten del directori de professionals, no de la reserva:
  // la RLS no deixa que el client llegeixi aquell perfil per la via normal.
  const withTrainer = upcoming.slice(0, MAX_UPCOMING + 1).map((r) => {
    const t = r.trainerId ? trainers.get(r.trainerId) : null;
    return {
      ...r,
      trainerName: t?.name ?? r.trainerName,
      trainerAvatarPath: t?.avatarPath ?? r.trainerAvatarPath,
    };
  });
  const shownWithTrainer = withTrainer.slice(0, MAX_UPCOMING);

  // Les fotos, totes d'un cop.
  const avatars = await avatarUrls(withTrainer.map((r) => r.trainerAvatarPath));

  // Les targetes de "creixement": regalar i portar un amic. Es calculen aquí
  // per saber quantes n'hi haurà i decidir com es col·loquen.
  const growth = [
    centerSettings.giftVouchersEnabled ? <GiftCta key="gift" /> : null,
    showReferral && referral ? (
      <ReferralCta
        key="referral"
        code={referral.code}
        referredCount={referral.referredCount}
        discountPercent={centerSettings.referralDiscountPercent}
      />
    ) : null,
  ].filter(Boolean);

  const communityHasContent =
    showCommunity && (announcements.length > 0 || polls.length > 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <Header name={firstName} />

      <KpiRow kpis={kpis} />

      <QuickActions />

      {/* Primer les reserves i després els bons: el que un client mira en
          obrir l'app és quan té la pròxima sessió, no quantes li queden. Amb
          els bons a sobre, l'agenda quedava sota la línia de scroll.

          Dues columnes a partir de `lg`: l'agenda a l'esquerra i, a la dreta,
          la pròxima sessió. En mòbil van una sota l'altra, amb la pròxima
          sessió PRIMER: és el que es mira quan s'obre l'app. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="order-2 lg:order-1 lg:col-span-2">
          <UpcomingReservations
            reservations={shownWithTrainer}
            avatars={avatars}
            palette={palette}
            minCancellationHours={centerSettings.minCancellationHours}
          />
        </div>

        <div className="order-1 flex flex-col gap-4 lg:order-2">
          {withTrainer[0] && (
            <NextSessionCard
              reservation={withTrainer[0]}
              avatars={avatars}
              palette={palette}
            />
          )}
        </div>
      </div>

      <ActiveBonos bonos={bonos} />

      {/* Comunitat i les targetes de creixement comparteixen la mateixa
          graella: el mur a l'esquerra i les targetes com a columna al costat.
          Abans els referits flotaven sols sota la pròxima sessió i quedaven
          com una peça solta enmig de la pàgina. */}
      {(communityHasContent || growth.length > 0) && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {communityHasContent && (
            <section className="flex flex-col gap-4 lg:col-span-2">
              <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
                Comunitat
              </h2>
              {polls.map((p) => (
                <PollCard key={p.id} poll={p} />
              ))}
              <CommunityBoard announcements={announcements} />
            </section>
          )}

          {growth.length > 0 && (
            <aside
              className={
                // Sense mur al costat no té sentit una columna estreta i
                // buida: les targetes s'obren a tota l'amplada, de costat.
                communityHasContent
                  ? "flex flex-col gap-4"
                  : "grid gap-4 lg:col-span-3 lg:grid-cols-2"
              }
            >
              {growth}
            </aside>
          )}
        </div>
      )}
    </main>
  );
}

function Header({ name }: { name: string }) {
  return (
    <div>
      <p className="text-sm text-brand-muted">{formatLongDate(new Date())}</p>
      <h1 className="mt-0.5 text-2xl font-bold text-brand-dark">
        Hola, {name}! 👋
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        Estem encantats de tenir-te aquí.
      </p>
    </div>
  );
}
