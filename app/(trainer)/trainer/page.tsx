import { getViewer } from "@/lib/auth";
import { listClients } from "@/lib/data/clients";
import {
  listReservationsInRange,
  listUpcomingReservations,
  type ReservationListItem,
} from "@/lib/data/reservations";
import { listToMark } from "@/lib/data/trainer-inbox";
import { addDaysStr, centerDayStart, centerToday } from "@/lib/center-time";
import { listAnnouncements } from "@/lib/data/announcements";
import { getTrainerDashboard } from "@/lib/data/dashboard";
import { pendingTrialAttention } from "@/lib/data/trial-attention";
import { clientsWithClinicalNovelty } from "@/lib/data/clinical-history";
import { AnnouncementsFeed } from "@/components/announcements-feed";
import { TrainerUpcomingReservations } from "@/components/trainer-upcoming-reservations";
import { TrainerBonusPanel } from "@/components/trainer-bonus-panel";
import { LowBonosCard } from "@/components/low-bonos-card";
import {
  Header,
  TrainerDay,
  ToDo,
  KpiRow,
  MyClients,
} from "@/components/trainer/home-sections";
import { formatLongDate } from "@/lib/labels";
import Link from "next/link";

export const dynamic = "force-dynamic";

/*
 * Quantes en porta cada pestanya de "Properes reserves".
 *
 * Viuen aquí i no al component: aquell és "use client", i una constant
 * importada d'un mòdul de client a un de servidor no arriba com a número sinó
 * com a referència de client. El límit hauria quedat buit.
 */
const UPCOMING_MINE = 6;
const UPCOMING_ALL = 15;
/** Marge per a les seves d'avui, que es treuen de la llista. */
const UPCOMING_EXTRA = 12;

/**
 * Les pròximes reserves: les seves i les del centre, ja retallades a les que
 * es pinten. Abans arribava al navegador TOT l'històric del centre.
 */
async function upcoming(trainerId: string, skip: Promise<Set<string>>): Promise<{
  mine: ReservationListItem[];
  all: ReservationListItem[];
  failed: boolean;
}> {
  try {
    // Les seves d'avui ja surten a «El teu dia»: aquí no es repeteixen. Es
    // demanen de més per omplir la llista després de treure-les.
    const [mine, all, hide] = await Promise.all([
      listUpcomingReservations({ limit: UPCOMING_MINE + UPCOMING_EXTRA, trainerId }),
      listUpcomingReservations({ limit: UPCOMING_ALL + UPCOMING_EXTRA }),
      skip,
    ]);
    return {
      mine: mine.filter((r) => !hide.has(r.id)).slice(0, UPCOMING_MINE),
      all: all.filter((r) => !hide.has(r.id)).slice(0, UPCOMING_ALL),
      failed: false,
    };
  } catch (e) {
    console.error("[inici professional] properes reserves:", e instanceof Error ? e.message : e);
    return { mine: [], all: [], failed: true };
  }
}

/** Les seves sessions d'avui (hora del centre), sense les anul·lades. */
async function today(trainerId: string): Promise<{ day: ReservationListItem[]; failed: boolean }> {
  try {
    const d = centerToday();
    const rows = await listReservationsInRange({
      from: centerDayStart(d),
      to: centerDayStart(addDaysStr(d, 1)),
      trainerId,
    });
    const day = rows
      .filter((r) => r.trainerId === trainerId && (r.status === "booked" || r.status === "completed"))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return { day, failed: false };
  } catch (e) {
    console.error("[inici professional] sessions d'avui:", e instanceof Error ? e.message : e);
    return { day: [], failed: true };
  }
}

/**
 * Àrea del professional. El middleware garanteix el rol 'trainer'.
 * Veu tots els clients per coordinar-se; gestiona només els seus.
 */
export default async function TrainerHome() {
  const viewer = await getViewer();
  const trainerId = viewer?.id ?? "";

  const dayPromise = today(trainerId);
  const [clients, next, announcements, kpi, trials, novelty, day, mark] =
    await Promise.all([
      listClients(trainerId),
      // Les seves i les del centre, per al toggle Els meus / Tots.
      upcoming(trainerId, dayPromise.then((d) => new Set(d.day.map((r) => r.id)))),
      listAnnouncements(),
      getTrainerDashboard(trainerId),
      // Lectura pura: obrir l'inici no ha d'escriure res.
      pendingTrialAttention(trainerId),
      // Historial clínic dels seus clients amb canvis d'altres (0110). Si falla,
      // l'inici es pinta igual: l'avís també surt a la fitxa.
      clientsWithClinicalNovelty(trainerId).catch((e) => {
        console.error("[inici professional] historial clínic:", e instanceof Error ? e.message : e);
        return [] as string[];
      }),
      dayPromise,
      // Les d'altres dies sense marcar: les d'avui ja surten a «El teu dia».
      listToMark({ trainerId }).catch((e) => {
        console.error("[inici professional] per marcar:", e instanceof Error ? e.message : e);
        return { toMark: [], truncated: false };
      }),
    ]);
  const todayIds = new Set(day.day.map((r) => r.id));
  const toMark = mark.toMark.filter((r) => !todayIds.has(r.id));
  const clinical = novelty.flatMap((id) => {
    const c = clients.find((x) => x.id === id);
    return c ? [{ id, name: c.fullName }] : [];
  });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      {/* L'ordre de l'auditoria de l'Inici: primer el que et toca (el dia),
          després el que has de fer, després els números i al final la resta. */}
      <Header
        name={viewer?.fullName?.split(" ")[0] ?? "professional"}
        today={formatLongDate(new Date())}
        day={day.day}
      />

      <TrainerDay day={day.day} failed={day.failed} />

      {/* Sense res pendent, no es pinta. */}
      <ToDo trials={trials} toMark={toMark} clinical={clinical} />

      <KpiRow d={kpi} />

      <TrainerUpcomingReservations
        mine={next.mine}
        all={next.all}
        myId={trainerId}
        failed={next.failed}
      />

      {/* No renderitza res si aquest professional no té bonus actiu. */}
      <TrainerBonusPanel trainerId={trainerId} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Si ha fallat, la targeta de dalt ja ho diu; una llista buida no. */}
        {!kpi.failed.includes("lowBonos") && (
          <LowBonosCard bonos={kpi.lowBonos} clientHrefBase="/trainer/clients" allHref="/trainer/bonos" />
        )}
        <MyClients clients={clients} />
      </div>

      {/* Només l'últim avís: la resta, a Comunitat. */}
      {announcements.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">Comunitat</h2>
            {announcements.length > 1 && (
              <Link href="/trainer/comunitat" className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:underline">
                Veure tots
              </Link>
            )}
          </div>
          <AnnouncementsFeed announcements={announcements.slice(0, 1)} />
        </section>
      )}
    </main>
  );
}
