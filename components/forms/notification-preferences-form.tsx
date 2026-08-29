"use client";

import { useActionState } from "react";
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

export function NotificationPreferencesForm({
  prefs,
  role,
}: {
  prefs: NotificationPreferences;
  role: Role;
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
          Notificacions
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          Tria de quins avisos vols rebre un correu.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-border">
        <div className="grid grid-cols-[1fr_5rem] items-center gap-2 border-b border-brand-border bg-brand-bg px-4 py-2 text-xs font-bold tracking-wide text-brand-muted uppercase">
          <span>Avís</span>
          <span className="text-center">Email</span>
        </div>

        {groups.map(({ group, events: groupEvents }) => (
          <div key={group}>
            {showGroupTitles && (
              <div className="border-b border-brand-border bg-brand-bg/60 px-4 py-1.5 text-[11px] font-bold tracking-wide text-brand-purple uppercase">
                {GROUP_LABELS[group]}
              </div>
            )}
            {groupEvents.map((type) => (
              <PrefRow key={type} type={type} prefs={prefs} />
            ))}
          </div>
        ))}
      </div>

      {state.error && <p className="text-sm text-error">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Preferències desades.</p>}

      <div>
        <button
          type="submit"
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light"
        >
          Desar preferències
        </button>
      </div>
    </form>
  );
}

function PrefRow({
  type,
  prefs,
}: {
  type: NotificationEventType;
  prefs: NotificationPreferences;
}) {
  const meta = EVENT_META[type];
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
          aria-label={`${meta.label} per email`}
        />
      </div>
    </div>
  );
}
