"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { USE_MOCK, MOCK_ROLE_COOKIE } from "@/lib/config";
import { Button } from "@/components/ui/button";

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

  return (
    <Button variant="outline" onClick={handleSignOut} className="px-3 py-1.5">
      Cerrar sesión
    </Button>
  );
}
