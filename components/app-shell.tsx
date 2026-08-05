import { AppSidebar } from "@/components/app-sidebar";
import { getViewer } from "@/lib/auth";
import { getCenterSettings } from "@/lib/data/center-settings";
import { avatarUrl } from "@/lib/data/avatars";
import { createAdminClient } from "@/lib/supabase/admin";
import { USE_MOCK } from "@/lib/config";
import type { Role } from "@/lib/nav";

/**
 * Marco común de las áreas privadas: sidebar (parametrizado por rol) + el
 * contenido, que en escritorio se desplaza para dejar sitio al sidebar fijo y
 * en móvil ocupa todo el ancho.
 */
export async function AppShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const [viewer, settings] = await Promise.all([
    getViewer(),
    getCenterSettings(),
  ]);

  // La foto del propi usuari per al sidebar. Es llegeix aquí i no a getViewer
  // perquè getViewer va per capçaleres del middleware al camí ràpid i no
  // toca la base de dades.
  let avatar: string | null = null;
  if (viewer && !USE_MOCK) {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("avatar_path")
      .eq("id", viewer.id)
      .maybeSingle();
    avatar = await avatarUrl(data?.avatar_path ?? null);
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <AppSidebar
        role={role}
        specialty={viewer?.specialty ?? null}
        fullName={viewer?.fullName ?? ""}
        email={viewer?.email ?? ""}
        avatarUrl={avatar}
        modules={settings.modules}
      />
      <div className="lg:pl-64">{children}</div>
    </div>
  );
}
