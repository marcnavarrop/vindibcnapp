import { AppSidebar } from "@/components/app-sidebar";
import type { Role } from "@/lib/nav";

/**
 * Marco común de las áreas privadas: sidebar (parametrizado por rol) + el
 * contenido, que en escritorio se desplaza para dejar sitio al sidebar fijo y
 * en móvil ocupa todo el ancho.
 */
export function AppShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <AppSidebar role={role} />
      <div className="lg:pl-64">{children}</div>
    </div>
  );
}
