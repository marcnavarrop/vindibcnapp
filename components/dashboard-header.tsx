import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { SignOutButton } from "@/components/sign-out-button";
import { USE_MOCK } from "@/lib/config";

/**
 * Cabecera común de las áreas privadas: wordmark, etiqueta del área, distintivo
 * de modo demo y botón de cerrar sesión.
 */
export function DashboardHeader({
  area,
  home,
}: {
  area: string;
  /** Ruta del inicio del área (para que el wordmark sea clicable). */
  home: string;
}) {
  return (
    <header className="border-b border-brand-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href={home}>
            <Wordmark className="text-xl" />
          </Link>
          <span className="text-xs font-bold tracking-widest text-brand-muted uppercase">
            {area}
          </span>
          {USE_MOCK && (
            <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-orange uppercase">
              Demo
            </span>
          )}
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
