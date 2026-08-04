import Link from "next/link";
import { LoginPanel } from "@/app/(auth)/login/login-panel";
import { TrialCta } from "@/components/trial-cta";

export default async function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-6">
      <LoginPanel />
      <TrialCta variant="card" />
      <footer className="mt-6 text-center text-xs text-brand-muted">
        <Link href="/legal/privacitat" className="hover:text-brand-purple">
          Privacitat
        </Link>{" "}
        ·{" "}
        <Link href="/legal/avis-legal" className="hover:text-brand-purple">
          Avís legal
        </Link>{" "}
        ·{" "}
        <Link href="/legal/cookies" className="hover:text-brand-purple">
          Cookies
        </Link>
      </footer>
    </main>
  );
}
