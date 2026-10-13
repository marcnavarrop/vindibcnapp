import { getViewer } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/data/dashboard";
import {
  listReservationsInRange,
  type ReservationListItem,
} from "@/lib/data/reservations";
import { getAdminAttention } from "@/lib/data/admin-attention";
import { getAgendaHealth } from "@/lib/data/admin-agenda-health";
import { LowBonosCard } from "@/components/low-bonos-card";
import {
  Header,
  KpiRow,
  ToResolve,
  TodayAtCentre,
} from "@/components/admin/home-sections";
import { formatLongDate } from "@/lib/labels";
import { addDaysStr, centerDayStart, centerToday } from "@/lib/center-time";
import { COUNTS_AS_OCCUPIED } from "@/lib/occupancy";
import { getDemoWorld, isDemoRow } from "@/lib/data/demo-world";

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
    // I sense el món demo (`demo_profiles`), com la resta de l'Inici.
    const demo = await getDemoWorld();
    return {
      list: list.filter(
        (r) => COUNTS_AS_OCCUPIED(r.status) && !isDemoRow(demo, { clientId: r.clientId, trainerId: r.trainerId }),
      ),
      failed: false,
    };
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

  // L'ordre de l'auditoria de l'Inici (13/10/2026): primer el que demana
  // feina, després el dia, després els números i al final el detall.
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <Header
        name={viewer?.fullName?.split(" ")[0] ?? "admin"}
        today={formatLongDate(new Date())}
      />

      {/* 1. Per resoldre: proves, sense marcar, cobraments, vals, clients
          sense entrenador, fora d'horari, grups amb cua i referits, cadascun
          amb el botó que el resol. Si no hi ha res, no es pinta. */}
      <ToResolve a={attention} h={health} pending={d.pendingBonos} />

      {/* 2. El dia: totes les sessions, amb el seu estat. */}
      <TodayAtCentre reservations={today.list} failed={today.failed} />

      {/* 3. Com va el centre: quatre números, sense comptes demo. */}
      <KpiRow d={d} />

      {/* 4. A qui oferir renovació: els cinc primers. */}
      {!d.failed.includes("lowBonos") && (
        <LowBonosCard bonos={d.lowBonos} clientHrefBase="/admin/clients" allHref="/admin/bonos" />
      )}
    </main>
  );
}
