import { NotFoundPanel } from "@/components/not-found-panel";

/** «No existeix» dins de l'àrea del professional: el mateix que a l'admin. */
export default function TrainerNotFound() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <NotFoundPanel
        title="Aquesta pàgina no existeix"
        body="Pot ser que l'enllaç sigui antic, que s'hagi esborrat el que mostrava (un client, un exercici…) o que l'adreça estigui mal escrita."
        backHref="/trainer"
        backLabel="Tornar a l'inici"
      />
    </main>
  );
}
