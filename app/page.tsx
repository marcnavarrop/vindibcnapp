import Link from "next/link";

/**
 * Página de inicio. Identidad VindiBCN: hero oscuro con destellos de marca
 * (morado/naranja) y accesos a la app.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-bg p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-brand-dark p-10 text-white shadow-xl">
        {/* Destellos de marca */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--color-brand-purple)_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--color-brand-orange)_0%,transparent_70%)]" />

        <div className="relative flex flex-col gap-8">
          <header className="flex flex-col gap-3">
            <span className="font-display text-3xl font-bold tracking-tight">
              Vindi<span className="text-brand-orange">BCN</span>
            </span>
            <p className="text-sm text-white/70">
              Gestió del centre d&apos;entrenament personal i fisioteràpia.
            </p>
          </header>

          <nav className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-bold tracking-wide uppercase transition-opacity hover:opacity-90"
            >
              Iniciar sessió
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg border border-white/30 px-4 py-2.5 text-sm font-bold tracking-wide uppercase transition-colors hover:bg-white/10"
            >
              Crear compte
            </Link>
          </nav>

          <p className="text-xs text-white/40">
            Àrees:{" "}
            <Link href="/admin" className="underline hover:text-white/70">
              /admin
            </Link>{" "}
            ·{" "}
            <Link href="/trainer" className="underline hover:text-white/70">
              /trainer
            </Link>{" "}
            ·{" "}
            <Link href="/client" className="underline hover:text-white/70">
              /client
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
