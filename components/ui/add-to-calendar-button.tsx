"use client";

import { useState, useRef, useEffect } from "react";
import {
  buildCalendarEvent,
  buildGoogleCalendarUrl,
  buildIcsContent,
} from "@/lib/calendar-links";
import type { ServiceType } from "@/types/database";

type Props = {
  serviceType: ServiceType;
  otherPartyName: string | null;
  scheduledAt: string;
  className?: string;
};

export function AddToCalendarButton({
  serviceType,
  otherPartyName,
  scheduledAt,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function downloadIcs() {
    const event = buildCalendarEvent({ serviceType, otherPartyName, scheduledAt });
    const blob = new Blob([buildIcsContent(event)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sessio-vindibcn.ics";
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  function openGoogle() {
    const event = buildCalendarEvent({ serviceType, otherPartyName, scheduledAt });
    window.open(buildGoogleCalendarUrl(event), "_blank", "noopener");
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-brand-border bg-white px-3 py-1.5 text-xs font-bold text-brand-charcoal hover:border-brand-purple hover:text-brand-purple"
      >
        <CalendarIcon />
        Afegir al calendari
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-brand-border bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={openGoogle}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-brand-charcoal hover:bg-brand-bg"
          >
            <GoogleIcon />
            Google Calendar
          </button>
          <button
            type="button"
            onClick={downloadIcs}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-brand-charcoal hover:bg-brand-bg"
          >
            <AppleIcon />
            Apple Calendar
          </button>
          <button
            type="button"
            onClick={downloadIcs}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-brand-charcoal hover:bg-brand-bg"
          >
            <OutlookIcon />
            Outlook / altres (.ics)
          </button>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0"
    >
      <rect
        x="1"
        y="3"
        width="14"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M1 7h14" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 1v4M11 1v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0 text-brand-charcoal"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0"
    >
      <rect x="2" y="4" width="13" height="16" rx="1.5" fill="#0078D4" />
      <path
        d="M8.5 9.5a3 3 0 1 0 0 5 3 3 0 0 0 0-5z"
        fill="white"
      />
      <path
        d="M15 8h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-5V8z"
        fill="#0078D4"
      />
      <path d="M15 10l3 2-3 2" stroke="white" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
