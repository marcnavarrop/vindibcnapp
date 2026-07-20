"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    if (USE_MOCK) {
      document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
    } else {
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
