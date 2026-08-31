import { getViewer } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/data/dashboard";
import { listReservations } from "@/lib/data/reservations";
import { getAdminAttention } from "@/lib/data/admin-attention";
import { LowBonosCard } from "@/components/low-bonos-card";
import {
  Header,
  KpiRow,
  QuickActions,
  Attention,
  TodayAtCentre,
  OccupancyByTrainer,
} from "@/components/admin/home-sections";
import { formatLongDate } from "@/lib/labels";
import { centerDateStr, centerToday } from "@/lib/center-time";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [viewer, d, allReservations, attention] = await Promise.all([
    getViewer(),
    getAdminDashboard(),
    listReservations(),
    getAdminAttention(),
  ]);

  /*
   * "Avui" en hora del CENTRE, no del servidor.
   *
   * A Vercel el servidor va en UTC, i comparar contra la seva mitjanit posaria
   * les sessions de primera hora al dia d'abans durant l'estiu. Es fa servir
   * el mateix ajudant que la resta de l'app.
   */
  const today = centerToday();
  const todaySessions = allReservations.filter(
    (r) => r.status === "booked" && centerDateStr(new Date(r.scheduledAt)) === today,
  );

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <Header
        name={viewer?.fullName?.split(" ")[0] ?? "admin"}
        today={formatLongDate(new Date())}
      />

      <KpiRow d={d} />

      <QuickActions />

      {/* Va per damunt de l'agenda del dia: si hi ha alguna cosa que caduca,
          es veu abans de posar-se a mirar les sessions. Si no hi ha res, no
          es pinta i la pantalla no en queda cap rastre. */}
      <Attention a={attention} />

      <TodayAtCentre reservations={todaySessions} />

      {/* El detall que abans vivia dins de dues targetes de mètrica: la llista
          de bons a punt d'esgotar-se i les barres per professional. Segueixen
          sent el mateix contingut, ara amb l'espai que necessiten. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <LowBonosCard bonos={d.lowBonos} clientHrefBase="/admin/clients" />
        <OccupancyByTrainer d={d} />
      </div>
    </main>
  );
}
