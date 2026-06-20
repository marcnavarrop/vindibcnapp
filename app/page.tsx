import Link from "next/link";

/**
 * Página de inicio mínima. El diseño de marca de Vindi se aplicará en una
 * fase posterior; por ahora solo da puntos de entrada a la app.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 p-8">
      <header>
        <h1 className="text-3xl font-bold">VindiBCN</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gestión del centro de entrenamiento personal y fisioterapia.
        </p>
      </header>

      <nav className="flex flex-col gap-3">
        <Link
          href="/login"
          className="rounded-md bg-black px-4 py-2 text-center text-sm font-medium text-white"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-gray-300 px-4 py-2 text-center text-sm font-medium"
        >
          Crear cuenta
        </Link>
      </nav>

      <p className="text-xs text-gray-400">
        Áreas: <Link href="/admin" className="underline">/admin</Link> ·{" "}
        <Link href="/trainer" className="underline">/trainer</Link> ·{" "}
        <Link href="/client" className="underline">/client</Link>
      </p>
    </main>
  );
}
