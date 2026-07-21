import { SERVICE_LABELS } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

export const SESSION_DURATION_MINUTES = 60;

export type CalendarEvent = {
  title: string;
  start: Date;
  durationMinutes: number;
  location: string;
  description: string;
};

export function buildCalendarEvent({
  serviceType,
  trainerName,
  scheduledAt,
}: {
  serviceType: ServiceType;
  trainerName: string | null;
  scheduledAt: string | Date;
}): CalendarEvent {
  const start = new Date(scheduledAt);
  const serviceLabel = SERVICE_LABELS[serviceType];
  const title = trainerName
    ? `${serviceLabel} amb ${trainerName} · VindiBCN`
    : `${serviceLabel} · VindiBCN`;
  return {
    title,
    start,
    durationMinutes: SESSION_DURATION_MINUTES,
    location: "VindiBCN, Gràcia, Barcelona",
    description: `${serviceLabel} a VindiBCN.`,
  };
}

function toUtcIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const end = new Date(
    event.start.getTime() + event.durationMinutes * 60_000,
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcIcs(event.start)}/${toUtcIcs(end)}`,
    details: event.description,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsContent(event: CalendarEvent): string {
  const end = new Date(
    event.start.getTime() + event.durationMinutes * 60_000,
  );
  const uid = `${event.start.getTime()}-vindibcn@vindibcn.com`;
  const now = toUtcIcs(new Date());

  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//VindiBCN//CA",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${toUtcIcs(event.start)}`,
      `DTEND:${toUtcIcs(end)}`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.location}`,
      `DESCRIPTION:${event.description}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n"
  );
}
