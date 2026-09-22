import { AppSidebar } from "@/components/app-sidebar";
import { PreModeBanner } from "@/components/pre-mode-banner";
import { SupportFab } from "@/components/support-fab";
import { getViewer } from "@/lib/auth";
import { getCenterSettings } from "@/lib/data/center-settings";
import { avatarUrl } from "@/lib/data/avatars";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientBadgeCounts } from "@/lib/data/client-badges";
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
  async function ownAvatar(): Promise<string | null> {
    if (!viewer || USE_MOCK) return null;
    const { data } = await createAdminClient()
      .from("profiles")
      .select("avatar_path")
      .eq("id", viewer.id)
      .maybeSingle();
    return avatarUrl(data?.avatar_path ?? null);
  }

  /*
   * Els números de les piloteta del menú, calculats AQUÍ i no dins de cada
   * piloteta en muntar-se.
   *
   * Abans cadascuna es demanava el seu amb una Server Action i el número
   * apareixia 999 ms després que la pantalla. Baixant-lo com a prop ja ve
   * dins de l'HTML i es pinta al primer frame. No reprodueix el problema del
   * número ranci —el que ens va mossegar dues vegades avui— perquè la piloteta
   * NOMÉS el fa servir per al valor de sortida: a partir d'aquí mana el
   * magatzem compartit, que actualitzen els avisos de sempre.
   *
   * NOMÉS PER AL CLIENT
   *
   * L'admin i el professional no tenen cap piloteta al menú (la seva és la del
   * botó de suport, que se la segueix demanant ella) i no han de pagar ni una
   * consulta per una cosa que no veuran. Per això va condicionat al rol i no
   * "per si de cas".
   */
  const [avatar, badges] = await Promise.all([
    ownAvatar(),
    role === "client" && viewer
      ? getClientBadgeCounts(viewer.id, settings.modules)
      : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen bg-brand-bg">
      <AppSidebar
        role={role}
        specialty={viewer?.specialty ?? null}
        fullName={viewer?.fullName ?? ""}
        email={viewer?.email ?? ""}
        avatarUrl={avatar}
        modules={settings.modules}
        badges={badges}
      />
      {/* En imprimir no hi ha sidebar, així que el contingut no ha de
          deixar-li lloc: sense això el manual sortiria escapçat per la dreta. */}
      <div className="lg:pl-64 print:pl-0">
        {/* El distintiu del mode PRE, a la columna del contingut i no a la
            pàgina: aquí surt a les tres àrees i no se'n pot quedar cap sense,
            que és el mateix criteri que el `SupportFab` de sota. Quan el mode
            està apagat no pinta res. */}
        <PreModeBanner />
        {children}
      </div>

      {/* Accés ràpid al suport des de qualsevol pantalla de les àrees internes.
          Va aquí i no a cada pàgina: així no se'n pot quedar cap sense.
          El client NO el veu: el suport és un canal de l'equip cap a qui
          desenvolupa, i la RLS ni tan sols el deixaria obrir cap tiquet. */}
      {role !== "client" && (
        <SupportFab
          basePath={`/${role}/suport`}
          // La piloteta amb els tiquets oberts, només per a l'admin: és qui
          // els resol. Al professional li diria quants dels seus segueixen
          // oberts, que és una espera i no una feina seva, i no la podria fer
          // baixar.
          showOpenCount={role === "admin"}
        />
      )}
    </div>
  );
}
