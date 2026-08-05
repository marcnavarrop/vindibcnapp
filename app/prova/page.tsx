import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { getPublicTrialData } from "@/lib/data/trial-bookings";
import { TrialCalendar } from "@/components/trial-calendar";
import { requestTrialAction } from "@/app/prova/actions";
import { assertModuleEnabled } from "@/lib/data/module-guard";
import { getCenterSettings } from "@/lib/data/center-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sessió de prova gratuïta · VindiBCN",
  description: "Demana una sessió de prova d'entrenament personal sense compromís.",
};

export default async function ProvaPage() {
  await assertModuleEnabled("sessionsProva");
  const [data, centerSettings] = await Promise.all([
    getPublicTrialData(),
    getCenterSettings(),
  ]);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Wordmark />
        <Link
          href="/login"
          className="text-sm font-bold text-brand-muted hover:text-brand-purple"
        >
          Ja tens compte? Entra
        </Link>
      </div>

      <h1 className="text-2xl text-brand-dark">Sessió de prova gratuïta</h1>
      <p className="mt-2 mb-6 max-w-2xl text-sm text-brand-muted">
        Prova un entrenament personal sense compromís. Tria una franja lliure i
        deixa&apos;ns les teves dades: un professional confirmarà la teva sessió.
        No cal crear cap compte.
      </p>

      <TrialCalendar
        data={data}
        action={requestTrialAction}
        openingHour={centerSettings.openingHour}
        closingHour={centerSettings.closingHour}
      />
    </main>
  );
}
