"use client";

import { useRouter } from "next/navigation";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    if (USE_MOCK) {
      document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
    } else {
      // Import dinàmic a propòsit: aquest botó viu al layout de tots els rols,
      // i amb un import estàtic tot @supabase/supabase-js (~51 kB gzip, amb
      // realtime, que no fem servir) entrava al bundle de CADA pantalla.
      // Així només es descarrega quan algú tanca sessió de veritat.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.replace("/login");
    router.refresh();
  }

  // Botó propi (compacte) en lloc del <Button> global, que força px-4/uppercase
  // amples: aquí el volem petit i proporcionat al peu del menú.
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="shrink-0 rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-xs font-bold tracking-wide text-brand-charcoal uppercase transition-colors hover:bg-brand-bg"
    >
      Tancar sessió
    </button>
  );
}
