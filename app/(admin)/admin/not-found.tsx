import { NotFoundPanel } from "@/components/not-found-panel";

/**
 * «No existeix» dins de l'administració: una fitxa que ja no hi és (un client,
 * un exercici esborrat) o una adreça mal escrita. Surt dins del marc, amb el
 * menú, i en català com la resta de l'àrea.
 */
export default function AdminNotFound() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <NotFoundPanel
        title="Aquesta pàgina no existeix"
        body="Pot ser que l'enllaç sigui antic, que s'hagi esborrat el que mostrava (un client, un exercici…) o que l'adreça estigui mal escrita."
        backHref="/admin"
        backLabel="Tornar a l'inici"
      />
    </main>
  );
}
