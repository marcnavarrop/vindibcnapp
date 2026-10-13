import { getViewer } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/data/dashboard";
import {
  listReservationsInRange,
  type ReservationListItem,
} from "@/lib/data/reservations";
import { getAdminAttention } from "@/lib/data/admin-attention";
import { getAgendaHealth } from "@/lib/data/admin-agenda-health";
import { AgendaHealthCards } from "@/components/admin/agenda-health";
import { LowBonosCard } from "@/components/low-bonos-card";
import {
  Header,
  KpiRow,
  QuickActions,
  collectableHref,
  Attention,
  TodayAtCentre,
  OccupancyByTrainer,
} from "@/components/admin/home-sections";
import { formatLongDate } from "@/lib/labels";
import { addDaysStr, centerDayStart, centerToday } from "@/lib/center-time";
import { COUNTS_AS_OCCUPIED } from "@/lib/occupancy";

export const dynamic = "force-dynamic";

/**
 * Les sessions d'avui, i res més: abans es portava tot l'històric del centre
 * per quedar-se amb les d'avui.
 *
 * "Avui" en hora del CENTRE, no del servidor: a Vercel el servidor va en UTC,
 * i comparar contra la seva mitjanit posaria les sessions de primera hora al
 * dia d'abans durant l'estiu.
 *
 * Si la consulta falla, es diu a la pantalla en comptes de "avui no hi ha res".
 */
async function todaySessions(): Promise<{ list: ReservationListItem[]; failed: boolean }> {
  const today = centerToday();
  try {
    const list = await listReservationsInRange({
      from: centerDayStart(today),
      to: centerDayStart(addDaysStr(today, 1)),
    });
    // Reservades i fetes (no les cancel·lades): el mateix que compta la xifra
    // «Sessions avui» de dalt (`COUNTS_AS_OCCUPIED`). Abans només les
    // reservades, i la llista deia 8 on la xifra deia 10.
    return { list: list.filter((r) => COUNTS_AS_OCCUPIED(r.status)), failed: false };
  } catch (e) {
    console.error("[inici admin] sessions d'avui:", e instanceof Error ? e.message : e);
    return { list: [], failed: true };
  }
}

export default async function AdminHome() {
  const [viewer, d, today, attention, health] = await Promise.all([
    getViewer(),
    getAdminDashboard(),
    todaySessions(),
    getAdminAttention(),
    getAgendaHealth(),
  ]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <Header
        name={viewer?.fullName?.split(" ")[0] ?? "admin"}
        today={formatLongDate(new Date())}
      />

      <KpiRow d={d} />

      <QuickActions pendingHref={collectableHref(d.pendingBonos)} />

      {/* Va per damunt de l'agenda del dia: si hi ha alguna cosa que caduca,
          es veu abans de posar-se a mirar les sessions. Si no hi ha res, no
          es pinta i la pantalla no en queda cap rastre. */}
      <Attention a={attention} />

      <TodayAtCentre reservations={today.list} failed={today.failed} />

      {/* L'estat de l'agenda de tot el centre: el que no s'ha marcat, el que
          ha quedat fora de l'horari i els grups plens amb cua. Cada targeta
          porta on es resol, i si la seva lectura falla, ho diu. */}
      <AgendaHealthCards h={health} />

      {/* El detall que abans vivia dins de dues targetes de mètrica: la llista
          de bons a punt d'esgotar-se i les barres per professional. Segueixen
          sent el mateix contingut, ara amb l'espai que necessiten. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Si ha fallat, la targeta de dalt ja ho diu; una llista buida no. */}
        {!d.failed.includes("lowBonos") && (
          <LowBonosCard bonos={d.lowBonos} clientHrefBase="/admin/clients" allHref="/admin/bonos" />
        )}
        <OccupancyByTrainer d={d} />
      </div>
    </main>
  );
}
