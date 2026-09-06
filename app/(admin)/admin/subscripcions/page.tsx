import { listSubscriptions, getCycleState } from "@/lib/data/subscriptions";
import { SubscriptionsAdminTable } from "@/components/subscriptions-admin-table";
import { getCenterSettings } from "@/lib/data/center-settings";

export const dynamic = "force-dynamic";

/**
 * Les subscripcions del centre.
 *
 * L'estat del mes en curs es demana per a cadascuna, i és una consulta per
 * fila. És assumible perquè aquí no n'hi haurà mai centenars —una per client
 * que s'hi apunti— i perquè el que fa útil aquesta pantalla és justament veure
 * si el mes està cobrat i quantes sessions queden, que és el que porta l'admin
 * a mirar-la. El dia que en sobrin, la sortida és una consulta agregada, no
 * amagar la columna.
 */
export default async function AdminSubscriptionsPage() {
  const [subscriptions, settings] = await Promise.all([
    listSubscriptions(),
    getCenterSettings(),
  ]);

  const rows = await Promise.all(
    subscriptions.map(async (s) => {
      const cycle = await getCycleState(s);
      return {
        id: s.id,
        clientId: s.clientId,
        clientName: s.clientName,
        packageName: s.packageName,
        serviceType: s.serviceType,
        sessionsPerCycle: s.sessionsPerCycle,
        unitPrice: s.unitPrice,
        paymentMethod: s.paymentMethod,
        status: s.status,
        anchorDay: s.anchorDay,
        nextRenewalOn: s.nextRenewalOn,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        currentCycleStart: s.currentCycleStart,
        sessionsLeft: cycle.sessionsLeft,
        cycleBonoStatus: cycle.cycleBono?.status ?? null,
        extrasUsed: cycle.extrasUsed,
        extrasMax: cycle.extrasMax,
      };
    }),
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Subscripcions</h1>
      <p className="mb-6 text-sm text-brand-muted">
        La quota mensual dels bons de grup. Cada client es renova el dia del mes
        en què es va donar d&apos;alta, i el preu li queda congelat des
        d&apos;aquell dia.
        {!settings.subscriptionsEnabled && (
          <>
            {" "}
            <strong className="text-brand-orange">
              Ara mateix no se&apos;n poden contractar de noves
            </strong>{" "}
            (Configuració → Centre). Les que ja hi són es continuen renovant.
          </>
        )}
      </p>
      <SubscriptionsAdminTable rows={rows} />
    </main>
  );
}
