import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { getConsentStatus } from "@/lib/data/consents";
import { listAnnouncements } from "@/lib/data/announcements";
import { listPollsForClient } from "@/lib/data/polls";
import { getCenterSettings } from "@/lib/data/center-settings";
import { getColorPalette } from "@/lib/data/colors";
import { getReferralStats } from "@/lib/data/referral";
import { avatarUrls } from "@/lib/data/avatars";
import {
  usableBonos,
  upcomingReservations,
  listTrainerCards,
} from "@/lib/data/client-dashboard";
import { CommunityBoard } from "@/components/community-board";
import { PollCard } from "@/components/poll-card";
import {
  NextSessionHero,
  BookCta,
  BonoBalance,
  canRenew,
  UpcomingReservations,
} from "@/components/client/home-sections";
import { GiftCta, ReferralCta } from "@/components/client/growth-cards";
import { formatLongDate } from "@/lib/labels";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";
import { CenterContactLine } from "@/components/center-contact-line";

export const dynamic = "force-dynamic";

/** Quantes reserves i quants anuncis caben a l'inici abans de "veure'ls tots". */
const MAX_UPCOMING = 3;
/** Quants bons surten a «Sessions que et queden». */
const MAX_BONOS = 3;

export default async function ClientHome() {
  const [t, locale] = await Promise.all([
    getTranslations("home"),
    getLocale() as Promise<Locale>,
  ]);
  const viewer = await getViewer();

  // CADA COSA SURT QUAN TÉ EL QUE NECESSITA, no per tandes. La comunitat i el
  // codi de referit només esperen la configuració (si el mòdul és apagat, no es
  // demanen: serien consultes per a seccions que no es pintaran); les enquestes,
  // també la fitxa del client. Abans esperaven que acabés tota la primera tanda.
  const clientPromise = viewer ? getClientByProfile(viewer.id) : Promise.resolve(null);
  const settingsPromise = getCenterSettings();
  const [client, centerSettings, palette, trainers, announcements, polls, referral, consent] =
    await Promise.all([
      clientPromise,
      settingsPromise,
      getColorPalette(),
      listTrainerCards(),
      settingsPromise.then((s) => (s.modules.comunitat ? listAnnouncements() : [])),
      Promise.all([settingsPromise, clientPromise]).then(([s, c]) =>
        s.modules.comunitat && c ? listPollsForClient(c.id) : [],
      ),
      settingsPromise.then((s) =>
        s.referralProgramActive && viewer ? getReferralStats(viewer.id) : null,
      ),
      // Si li falta el consentiment de salut vigent (0118), se li demana aquí.
      viewer ? getConsentStatus(viewer.id).catch(() => null) : Promise.resolve(null),
    ]);
  const showCommunity = centerSettings.modules.comunitat;
  const showReferral = centerSettings.referralProgramActive;

  const firstName = viewer?.fullName?.split(" ")[0] ?? "";

  if (!client) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <Header
          greeting={t("greeting", { name: firstName })}
          welcome={t("welcome")}
          today={formatLongDate(new Date(), locale)}
        />
        <div className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          <p>{t("noClientRecord")}</p>
          <CenterContactLine className="mt-2" />
        </div>
      </main>
    );
  }

  const bonos = usableBonos(client);
  // «Sessions que et queden»: només els bons amb sessions i, com a molt,
  // MAX_BONOS; la resta, a «Veure tots». Primer els que es poden renovar (els
  // que s'acaben) i després els que caduquen abans.
  const shownBonos = bonos
    .filter((b) => b.remainingSessions > 0)
    .sort(
      (a, b) =>
        Number(canRenew(b, centerSettings.bonoLowThreshold)) - Number(canRenew(a, centerSettings.bonoLowThreshold)) ||
        (a.expiresAt ?? "9999").localeCompare(b.expiresAt ?? "9999"),
    )
    .slice(0, MAX_BONOS);
  // Bons ACABATS d'un servei del qual ja no en té cap amb sessions: no surten a
  // la llista (no queda res a gastar), però sí el seu «Renovar», que és quan més
  // falta fa. Un per servei, i només si es pot renovar (paquet de la botiga).
  const finished = client.bonos.filter(
    (b, i, all) =>
      b.status === "completed" &&
      canRenew(b, centerSettings.bonoLowThreshold) &&
      !bonos.some((u) => u.serviceType === b.serviceType && u.remainingSessions > 0) &&
      all.findIndex((x) => x.status === "completed" && x.serviceType === b.serviceType && !!x.serviceId) === i,
  );
  const upcoming = upcomingReservations(client, new Date().toISOString());

  // El nom i la foto surten del directori de professionals, no de la reserva:
  // la RLS no deixa que el client llegeixi aquell perfil per la via normal.
  // La primera va en gran; «Després», les MAX_UPCOMING següents.
  const withTrainer = upcoming.slice(0, MAX_UPCOMING + 1).map((r) => {
    const t = r.trainerId ? trainers.get(r.trainerId) : null;
    return {
      ...r,
      trainerName: t?.name ?? r.trainerName,
      trainerAvatarPath: t?.avatarPath ?? r.trainerAvatarPath,
    };
  });
  const later = withTrainer.slice(1);

  // Les fotos, totes d'un cop.
  const avatars = await avatarUrls(withTrainer.map((r) => r.trainerAvatarPath));

  // Les targetes de "creixement": regalar i portar un amic. Es calculen aquí
  // per saber quantes n'hi haurà i decidir com es col·loquen.
  const growth = [
    centerSettings.giftVouchersEnabled ? <GiftCta key="gift" /> : null,
    showReferral && referral ? (
      <ReferralCta
        key="referral"
        code={referral.code}
        referredCount={referral.referredCount}
        discountPercent={centerSettings.referralDiscountPercent}
      />
    ) : null,
  ].filter(Boolean);

  const communityHasContent =
    showCommunity && (announcements.length > 0 || polls.length > 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <Header
          greeting={t("greeting", { name: firstName })}
          welcome={t("welcome")}
          today={formatLongDate(new Date(), locale)}
        />

      {/* El consentiment de salut 2026-10 (0118): es demana a tothom, i a qui en
          té una versió anterior, que el torni a acceptar. És voluntari: no
          bloqueja res de l'app, només surt aquí fins que l'accepti. */}
      {consent && !consent.healthDataCurrent && (
        <section
          className="flex flex-col gap-3 rounded-2xl border border-attention bg-attention-bg p-4 text-sm text-attention sm:flex-row sm:items-center sm:justify-between sm:p-5"
          data-health-consent-ask={consent.healthDataAt ? "old" : "none"}
        >
          <div>
            <h2 className="font-bold">{t("healthConsent.title")}</h2>
            <p className="mt-0.5">{consent.healthDataAt ? t("healthConsent.updated") : t("healthConsent.new")}</p>
          </div>
          <Link
            href="/client/consentiment"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-brand-purple px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
          >
            {t("healthConsent.cta")}
          </Link>
        </section>
      )}

      {/* L'ordre de l'auditoria: el que et toca (la pròxima sessió), el que
          has de fer (reservar, renovar) i al final la resta. */}
      <NextSessionHero
        reservation={withTrainer[0] ?? null}
        avatars={avatars}
        palette={palette}
        minCancellationHours={centerSettings.minCancellationHours}
      />

      <BookCta />

      <BonoBalance bonos={shownBonos} finished={finished} lowThreshold={centerSettings.bonoLowThreshold} />

      {later.length > 0 && (
        <UpcomingReservations
          title={t("next.later")}
          reservations={later}
          avatars={avatars}
          palette={palette}
          minCancellationHours={centerSettings.minCancellationHours}
        />
      )}

      {/* Comunitat i les targetes de creixement comparteixen la mateixa
          graella: el mur a l'esquerra i les targetes com a columna al costat.
          Abans els referits flotaven sols sota la pròxima sessió i quedaven
          com una peça solta enmig de la pàgina. */}
      {(communityHasContent || growth.length > 0) && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {communityHasContent && (
            <section className="flex flex-col gap-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-bold tracking-widest text-brand-muted uppercase">
                  {t("community")}
                </h2>
                {announcements.length > 1 && (
                  <Link
                    href="/client/comunitat"
                    className="text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline"
                  >
                    {t("communitySeeAll")}
                  </Link>
                )}
              </div>
              {/* Les enquestes, totes: es responen aquí mateix. Dels anuncis,
                  només l'últim (com a l'Inici del professional); la resta, a
                  Comunitat. */}
              {polls.map((p) => (
                <PollCard key={p.id} poll={p} />
              ))}
              <CommunityBoard announcements={announcements.slice(0, 1)} locale={locale} />
            </section>
          )}

          {growth.length > 0 && (
            <aside
              className={
                // Sense mur al costat no té sentit una columna estreta i
                // buida: les targetes s'obren a tota l'amplada, de costat.
                communityHasContent
                  ? "flex flex-col gap-4"
                  : "grid gap-4 lg:col-span-3 lg:grid-cols-2"
              }
            >
              {growth}
            </aside>
          )}
        </div>
      )}
    </main>
  );
}

/**
 * El text arriba ja traduït des de la pàgina i no es tradueix aquí: la
 * capçalera és un component de servidor petit i passar-li dues cadenes surt
 * més barat que fer-lo demanar el seu propi diccionari.
 */
function Header({
  greeting,
  welcome,
  today,
}: {
  greeting: string;
  welcome: string;
  today: string;
}) {
  return (
    <div>
      <p className="text-sm text-brand-muted">{today}</p>
      <h1 className="mt-0.5 text-2xl font-bold text-brand-dark">{greeting}</h1>
      <p className="mt-1 text-sm text-brand-muted">{welcome}</p>
    </div>
  );
}
