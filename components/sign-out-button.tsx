"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import { clsx } from "@/lib/utils";

export function SignOutButton({
  /**
   * `compact` és el botonet blanc de sempre (barra de mòbil i peu dels menús
   * d'admin i professional). `panel` és el botó ample i buidat del peu del
   * menú del client, sobre el lila.
   */
  variant = "compact",
  label,
}: {
  variant?: "compact" | "panel";
  /** Text ja traduït. Sense res, es queda el català de sempre. */
  label?: string;
} = {}) {
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

  // Botó propi en lloc del <Button> global, que força px-4/uppercase amples:
  // aquí el volem proporcionat al peu del menú.
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={clsx(
        "rounded-lg text-xs font-bold tracking-wide uppercase transition-colors",
        variant === "panel"
          ? "flex w-full items-center justify-center gap-2 border border-white/25 px-3 py-2.5 text-white hover:bg-white/10"
          : "shrink-0 border border-brand-border bg-white px-2.5 py-1.5 text-brand-charcoal hover:bg-brand-bg",
      )}
    >
      {label ?? "Tancar sessió"}
      {variant === "panel" && <LogOut size={15} aria-hidden />}
    </button>
  );
}
