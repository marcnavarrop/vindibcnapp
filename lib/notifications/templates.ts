import "server-only";
import type { NotificationEvent } from "@/lib/notifications/types";

const PURPLE = "#642263";
const ORANGE = "#ff6d17";
const DARK = "#2b2b33";
const MUTED = "#6b7280";

/** Embolcall de marca comú a tots els correus. */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="ca"><body style="margin:0;background:#f4f4f6;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${DARK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr><td style="background:${PURPLE};padding:20px 28px;">
      <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Vindi<span style="color:${ORANGE};">BCN</span></span>
    </td></tr>
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 16px;font-size:19px;color:${DARK};">${title}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:${MUTED};">
      Reps aquest correu perquè tens activats aquests avisos a VindiBCN. Pots
      canviar les teves preferències des de la teva àrea, a Configuració.
    </td></tr>
  </table>
</body></html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${DARK};">${text}</p>`;
}
function detail(label: string, value: string): string {
  return `<tr><td style="padding:4px 0;color:${MUTED};font-size:14px;">${label}</td><td style="padding:4px 0;text-align:right;font-weight:700;font-size:14px;color:${DARK};">${value}</td></tr>`;
}
function box(rows: string): string {
  return `<table role="presentation" width="100%" style="background:#f9fafb;border-radius:10px;padding:8px 14px;margin:8px 0 16px;">${rows}</table>`;
}
/** Escapa text per evitar injecció d'HTML des de dades d'usuari. */
function esc(s: string): string {
  return (s ?? "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

export type RenderedEmail = { subject: string; html: string; text: string };

/** Construeix l'assumpte i el cos d'un email a partir de l'esdeveniment. */
export function renderEmail(event: NotificationEvent): RenderedEmail {
  const d = event.data;
  const name = esc(d.name ?? "");
  const hola = name ? `Hola ${name},` : "Hola,";

  switch (event.type) {
    case "reservation_confirmed": {
      const subject = "Reserva confirmada · VindiBCN";
      const html = layout(
        "La teva reserva està confirmada",
        p(hola) +
          p("Hem registrat la teva sessió:") +
          box(
            detail("Data", esc(d.when ?? "")) +
              detail("Servei", esc(d.service ?? "")) +
              (d.trainer ? detail("Professional", esc(d.trainer)) : ""),
          ) +
          p("Ens veiem aviat!"),
      );
      return { subject, html, text: `${hola}\nReserva confirmada: ${d.when} · ${d.service}${d.trainer ? " · " + d.trainer : ""}.` };
    }
    case "reservation_cancelled": {
      const subject = "Reserva cancel·lada · VindiBCN";
      const html = layout(
        "S'ha cancel·lat una reserva",
        p(hola) +
          p("S'ha anul·lat aquesta sessió:") +
          box(detail("Data", esc(d.when ?? "")) + detail("Servei", esc(d.service ?? ""))) +
          p("Si ha estat un error, contacta amb el centre o torna a reservar."),
      );
      return { subject, html, text: `${hola}\nReserva cancel·lada: ${d.when} · ${d.service}.` };
    }
    case "session_reminder": {
      const subject = "Recordatori: tens sessió demà · VindiBCN";
      const html = layout(
        "Tens una sessió demà",
        p(hola) +
          p("Et recordem la teva propera sessió:") +
          box(
            detail("Data", esc(d.when ?? "")) +
              detail("Servei", esc(d.service ?? "")) +
              (d.trainer ? detail("Professional", esc(d.trainer)) : ""),
          ) +
          p("Si no hi pots assistir, avisa'ns com abans millor."),
      );
      return { subject, html, text: `${hola}\nRecordatori: sessió demà ${d.when} · ${d.service}.` };
    }
    case "trial_request": {
      const subject = "Nova sol·licitud de sessió de prova · VindiBCN";
      const html = layout(
        "Nova sol·licitud de prova",
        p(hola) +
          p("Un visitant ha demanat una sessió de prova. Cal confirmar-la o rebutjar-la:") +
          box(
            detail("Nom", esc(d.visitorName ?? "")) +
              detail("Data", esc(d.when ?? "")) +
              detail("Telèfon", esc(d.phone ?? "")) +
              detail("Correu", esc(d.email ?? "")),
          ) +
          p("Gestiona-la des del teu calendari o des de «Sessions de prova»."),
      );
      return { subject, html, text: `${hola}\nNova prova de ${d.visitorName} el ${d.when} (${d.phone}, ${d.email}).` };
    }
    case "trial_status": {
      const confirmed = d.status === "confirmed";
      const subject = confirmed
        ? "La teva sessió de prova està confirmada · VindiBCN"
        : "Sobre la teva sessió de prova · VindiBCN";
      const html = layout(
        confirmed ? "Sessió de prova confirmada!" : "Sessió de prova no disponible",
        p(hola) +
          (confirmed
            ? p("Bones notícies: la teva sessió de prova ha estat confirmada.") +
              box(detail("Data", esc(d.when ?? ""))) +
              p("T'hi esperem!")
            : p("Ho sentim, no hem pogut confirmar la teva sessió de prova per a la data sol·licitada. Pots demanar-ne una altra quan vulguis des de la nostra web.")),
      );
      return { subject, html, text: `${hola}\n${confirmed ? "Prova confirmada: " + d.when : "La teva prova no s'ha pogut confirmar."}` };
    }
    case "bono_low": {
      const subject = "Et queda 1 sessió al bo · VindiBCN";
      const html = layout(
        "El teu bo s'acaba",
        p(hola) +
          p(`Et queda <strong>1 sessió</strong> al teu bo de ${esc(d.service ?? "")}.`) +
          p("Quan vulguis pots renovar-lo per no quedar-te sense sessions."),
      );
      return { subject, html, text: `${hola}\nEt queda 1 sessió al bo de ${d.service}.` };
    }
    case "community": {
      const subject = `${d.title ? esc(d.title) + " · " : ""}Novetats VindiBCN`;
      const html = layout(
        esc(d.title ?? "Novetats del centre"),
        p(hola) +
          p(esc(d.body ?? "").replace(/\n/g, "<br>")) +
          p("Ho pots veure també a la secció Comunitat de la teva àrea."),
      );
      return { subject, html, text: `${hola}\n${d.title}\n\n${d.body}` };
    }
  }
}
