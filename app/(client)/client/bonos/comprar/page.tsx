import Link from "next/link";

export default function ComprarBonoPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link
        href="/client/bonos"
        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
      >
        ← Tornar als bonos
      </Link>
      <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Comprar bo nou</h1>

      <div className="rounded-2xl border border-dashed border-brand-border bg-white p-10 text-center">
        <p className="text-lg font-bold text-brand-dark">Pròximament</p>
        <p className="mt-2 text-sm text-brand-muted">
          La compra de bonos en línia encara no està disponible. De moment,
          parla amb el centre per adquirir un bo nou.
        </p>
      </div>
    </main>
  );
}
