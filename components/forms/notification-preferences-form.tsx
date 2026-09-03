"use client";

import { TAP } from "@/lib/utils";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateNotificationPreferencesAction } from "@/lib/actions/notification-preferences";
import {
  EVENT_META,
  EVENT_ORDER,
  GROUP_LABELS,
  type NotificationEventType,
  type NotificationGroup,
} from "@/lib/notifications/types";
import { prefKey, type NotificationPreferences } from "@/lib/notifications/preferences-defaults";

type Role = "client" | "trainer" | "admin";

// Ordre dels grups a la UI (l'agenda primer per als professionals).
const GROUP_ORDER: NotificationGroup[] = ["agenda", "general"];

/**
 * Els textos ja resolts. Com al canvi de contrasenya: aquest formulari surt a
 * les tres àrees i només la del client va dins del proveïdor d'idioma, així
 * que el hook no es pot cridar al cos. El client passa pel camí traduït; els
 * altres dos, pel de sempre.
 */
type Texts = {
  title: string;
  hint: string;
  colAlert: string;
  colEmail: string;
  save: string;
  saved: string;
  failed: string;
  group: (g: NotificationGroup) => string;
  event: (t: NotificationEventType) => { label: string; description: string };
  byEmail: (label: string) => string;
};

const CA: Texts = {
  title: "Notificacions",
  hint: "Tria de quins avisos vols rebre un correu.",
  colAlert: "Avís",
  colEmail: "Email",
  save: "Desar preferències",
  saved: "Preferències desades.",
  failed: "No s'han pogut desar les preferències.",
  group: (g) => GROUP_LABELS[g],
  event: (t) => EVENT_META[t],
  byEmail: (label) => `${label} per email`,
};

export function NotificationPreferencesForm(props: {
  prefs: NotificationPreferences;
  role: Role;
}) {
  // Només el client va traduït: l'admin i el professional treballen en català
  // fix i no tenen proveïdor d'idioma sobre.
  return props.role === "client" ? (
    <Translated {...props} />
  ) : (
    <Body {...props} texts={CA} />
  );
}

function Translated(props: { prefs: NotificationPreferences; role: Role }) {
  const t = useTranslations("config.notifications");
  const tg = useTranslations("config.notifications.groups");
  const te = useTranslations("config.notifications.events");
  return (
    <Body
      {...props}
      texts={{
        title: t("title"),
        hint: t("hint"),
        colAlert: t("colAlert"),
        colEmail: t("colEmail"),
        save: t("save"),
        saved: t("saved"),
        failed: t("failed"),
        group: (g) => tg(g),
        // Els deu que veu el client són al diccionari; si mai n'arribés un
        // que no hi és, val més ensenyar el català que un error a la cara.
        event: (type) =>
          te.has(`${type}.label`)
            ? { label: te(`${type}.label`), description: te(`${type}.description`) }
            : EVENT_META[type],
        byEmail: (label) => t("byEmail", { label }),
      }}
    />
  );
}

function Body({
  prefs,
  role,
  texts,
}: {
  prefs: NotificationPreferences;
  role: Role;
  texts: Texts;
}) {
  const [state, formAction] = useActionState(
    updateNotificationPreferencesAction,
    {} as { error?: string; ok?: boolean },
  );

  const events = EVENT_ORDER.filter((t) =>
    EVENT_META[t].audience.includes(role),
  );
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    events: events.filter((t) => EVENT_META[t].group === g),
  })).filter((g) => g.events.length > 0);
  const showGroupTitles = groups.length > 1;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6"
    >
      <div>
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          {texts.title}
        </h2>
        <p className="mt-1 text-xs text-brand-muted">{texts.hint}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-border">
        <div className="grid grid-cols-[1fr_5rem] items-center gap-2 border-b border-brand-border bg-brand-bg px-4 py-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
          <span>{texts.colAlert}</span>
          <span className="text-center">{texts.colEmail}</span>
        </div>

        {groups.map(({ group, events: groupEvents }) => (
          <div key={group}>
            {showGroupTitles && (
              <div className="border-b border-brand-border bg-brand-bg/60 px-4 py-1.5 text-[11px] font-bold tracking-wide text-brand-purple uppercase">
                {texts.group(group)}
              </div>
            )}
            {groupEvents.map((type) => (
              <PrefRow key={type} type={type} prefs={prefs} texts={texts} />
            ))}
          </div>
        ))}
      </div>

      {state.error && <p className="text-sm text-error">{texts.failed}</p>}
      {state.ok && <p className="text-sm text-success">{texts.saved}</p>}

      <div>
        <button
          type="submit"
          className={`rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark ${TAP}`}
        >
          {texts.save}
        </button>
      </div>
    </form>
  );
}

function PrefRow({
  type,
  prefs,
  texts,
}: {
  type: NotificationEventType;
  prefs: NotificationPreferences;
  texts: Texts;
}) {
  const meta = texts.event(type);
  return (
    <div className="grid grid-cols-[1fr_5rem] items-center gap-2 border-b border-brand-border px-4 py-3 last:border-0">
      <div>
        <div className="text-sm font-bold text-brand-dark">{meta.label}</div>
        <div className="text-xs text-brand-muted">{meta.description}</div>
      </div>
      <div className="flex justify-center">
        <input
          type="checkbox"
          name={prefKey(type, "email")}
          defaultChecked={prefs[prefKey(type, "email")]}
          className="h-5 w-5 accent-brand-purple"
          aria-label={texts.byEmail(meta.label)}
        />
      </div>
    </div>
  );
}
