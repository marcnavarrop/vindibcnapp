import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { verifyUnsubscribe } from "@/lib/unsubscribe";
import { staticI18n } from "@/lib/i18n/no-request";
import { toLocale, type Locale } from "@/lib/i18n/config";
import { USE_MOCK } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeForSearch } from "@/lib/utils";
import { unsubscribeCommunityAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** L'idioma de qui rep el correu (el seu perfil), no el del navegador. */
async function localeOf(profileId: string): Promise<Locale> {
  if (USE_MOCK) {
    const { getStore } = await import("@/lib/mock/store");
    return toLocale(getStore().profiles.find((p) => p.id === profileId)?.preferred_language ?? null);
  }
  const { data } = await createAdminClient().from("profiles").select("preferred_language").eq("id", profileId).maybeSingle();
  return toLocale(data?.preferred_language ?? null);
}

/**
 * Deixar de rebre les novetats del centre per correu (0124, art. 21.2 LSSI),
 * des de l'enllaç de cada correu i SENSE iniciar sessió. L'enllaç porta l'id i
 * una signatura (lib/unsubscribe.ts). Obrir la pàgina no dona de baixa ningú: cal
 * prémer el botó (POST), perquè els antivirus del correu obren els enllaços.
 * L'enllaç d'un sol clic dels clients de correu és /api/unsubscribe/community.
 */
export default async function UnsubscribeCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; t?: string; estat?: string }>;
}) {
  const { p, t, estat } = await searchParams;
  const valid = verifyUnsubscribe(p, t);
  const locale = valid ? await localeOf(p!) : "ca";
  const i = staticI18n(locale).ns("unsubscribe");
  const tabs = staticI18n(locale).ns("config.tabs");
  const notifTab = normalizeForSearch(tabs("notifications")).trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const settings = `/client/configuracio?pestanya=${notifTab}`;

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-border bg-white">
        <div className="mx-auto flex max-w-xl items-center px-4 py-4 sm:px-6">
          <Link href="/">
            <Wordmark height={26} />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8 text-sm leading-relaxed text-brand-charcoal sm:px-6">
        <h1 className="text-2xl text-brand-dark">{i("title")}</h1>
        {!valid ? (
          <p data-unsubscribe-state="invalid">
            {i("invalid")}{" "}
            <Link href={settings} className="font-bold text-brand-purple underline">
              {i("settingsLink")}
            </Link>
            .
          </p>
        ) : estat === "fet" ? (
          <>
            <p className="rounded-xl border border-success/30 bg-success-bg px-3.5 py-2.5 text-success" data-unsubscribe-state="done">
              {i("done")}
            </p>
            <p>
              {i("changeMind")}{" "}
              <Link href={settings} className="font-bold text-brand-purple underline">
                {i("settingsLink")}
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            {estat === "error" && (
              <p role="alert" className="text-error" data-unsubscribe-state="error">
                {i("error")}
              </p>
            )}
            <p>{i("question")}</p>
            <p className="text-brand-muted">{i("stillReceive")}</p>
            <form action={unsubscribeCommunityAction}>
              <input type="hidden" name="p" value={p} />
              <input type="hidden" name="t" value={t} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-purple px-5 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
                data-unsubscribe-confirm
              >
                {i("confirm")}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
