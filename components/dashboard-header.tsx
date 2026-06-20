import { Wordmark } from "@/components/wordmark";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Cabecera común de las áreas privadas: wordmark, etiqueta del área y
 * botón de cerrar sesión.
 */
export function DashboardHeader({ area }: { area: string }) {
  return (
    <header className="border-b border-brand-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <Wordmark className="text-xl" />
          <span className="text-xs font-bold tracking-widest text-brand-muted uppercase">
            {area}
          </span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
