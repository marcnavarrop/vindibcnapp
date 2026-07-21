import { SERVICE_LABELS } from "@/lib/labels";
import type { ServiceType } from "@/types/database";

export const SESSION_DURATION_MINUTES = 60;

const CENTER_LOCATION =
  "Vindi BCN, Carrer de la Mare de Déu dels Desemparats, 14-16, Gràcia, 08012 Barcelona";

const TRAINING_SERVICES: ServiceType[] = [
  "ep_individual",
  "ep_parejas",
  "grupo_reducido",
];

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
  const isTraining = TRAINING_SERVICES.includes(serviceType);
  const prefix = isTraining ? "💪 " : "";
  const title = trainerName
    ? `${prefix}${serviceLabel} amb ${trainerName} · VindiBCN`
    : `${prefix}${serviceLabel} · VindiBCN`;
  const description = trainerName
    ? `Sessió amb ${trainerName}. ${serviceLabel} a VindiBCN.`
    : `${serviceLabel} a VindiBCN.`;
  return {
    title,
    start,
    durationMinutes: SESSION_DURATION_MINUTES,
    location: CENTER_LOCATION,
    description,
  };
}

function toUtcIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// RFC 5545 §3.1: fold lines longer than 75 octets (CRLF + space).
function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // Take up to 75 bytes from the current position (73 on continuation lines
    // to leave room for the leading space).
    const limit = start === 0 ? 75 : 74;
    let end = start + limit;
    if (end >= bytes.length) {
      parts.push(new TextDecoder().decode(bytes.slice(start)));
      break;
    }
    // Don't split in the middle of a multi-byte UTF-8 sequence.
    while (end > start && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
  }
  return parts.join("\r\n ");
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const end = new Date(
    event.start.getTime() + event.durationMinutes * 60_000,
  );
  // Build URL manually so commas in location are kept readable by Google Calendar.
  const encode = (s: string) => encodeURIComponent(s);
  return (
    `https://calendar.google.com/calendar/render` +
    `?action=TEMPLATE` +
    `&text=${encode(event.title)}` +
    `&dates=${toUtcIcs(event.start)}/${toUtcIcs(end)}` +
    `&details=${encode(event.description)}` +
    `&location=${encode(event.location)}`
  );
}

export function buildIcsContent(event: CalendarEvent): string {
  const end = new Date(
    event.start.getTime() + event.durationMinutes * 60_000,
  );
  const uid = `${event.start.getTime()}-vindibcn@vindibcn.com`;
  const now = toUtcIcs(new Date());

  const lines = [
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
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
