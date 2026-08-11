import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listAnnouncements } from "@/lib/data/announcements";
import { listPollsForClient } from "@/lib/data/polls";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
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
  ReferralCta,
} from "@/components/client/home-sections";
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
  // consulta per a una secció que no es pintarà.
  const showCommunity = centerSettings.modules.comunitat;
  const [announcements, polls] = await Promise.all([
    showCommunity ? listAnnouncements() : Promise.resolve([]),
    showCommunity && client
      ? listPollsForClient(client.id)
      : Promise.resolve([]),
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

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <Header name={firstName} />

      <KpiRow kpis={kpis} />

      <QuickActions />

      <ActiveBonos bonos={bonos} />

      {/* Dues columnes a partir de `lg`: l'agenda a l'esquerra i, a la dreta,
          la pròxima sessió i els referits. En mòbil van una sota l'altra, amb
          la pròxima sessió PRIMER: és el que es mira quan s'obre l'app. */}
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
          {centerSettings.referralProgramActive && <ReferralCta />}
        </div>
      </div>

      {showCommunity && (announcements.length > 0 || polls.length > 0) && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
            Comunitat
          </h2>
          {polls.map((p) => (
            <PollCard key={p.id} poll={p} />
          ))}
          <CommunityBoard announcements={announcements} />
        </section>
      )}
    </main>
  );
}

function Header({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm text-brand-muted">{formatLongDate(new Date())}</p>
        <h1 className="mt-0.5 text-2xl font-bold text-brand-dark">
          Hola, {name}! 👋
        </h1>
        <p className="mt-1 text-sm text-brand-muted">
          Estem encantats de tenir-te aquí.
        </p>
      </div>

      {/* Encara no existeix: es deixa a la vista com a avanç, però desactivat
          perquè ningú hi cliqui esperant que passi res. */}
      <button
        type="button"
        disabled
        title="Pròximament"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-bold text-brand-muted opacity-70"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="9" width="18" height="12" rx="2" />
          <path d="M3 13h18M12 9v12" />
          <path d="M12 9S10.5 3 7.5 3a2.5 2.5 0 000 5H12zM12 9s1.5-6 4.5-6a2.5 2.5 0 010 5H12z" />
        </svg>
        Regala benestar
        <span className="rounded-full bg-brand-orange/15 px-2 py-0.5 text-[10px] tracking-wide text-brand-orange uppercase">
          Aviat
        </span>
      </button>
    </div>
  );
}
