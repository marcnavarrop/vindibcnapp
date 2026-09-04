import { whatsappNumber, TAP } from "@/lib/utils";

/** El logo de WhatsApp: lucide no porta icones de marca. Mateix criteri que `YouTubeMark`. */
function WhatsAppMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#25D366"
        d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.470 1.5 1.08 2.5 1.23 2.68.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z"
      />
      <path
        fill="#25D366"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.13h-.01a8.23 8.23 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 015.83 2.42 8.19 8.19 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24z"
      />
    </svg>
  );
}

/**
 * Enllaç de contacte ràpid per WhatsApp.
 *
 * NO ES PINTA si no hi ha número marcable —ni apagat ni res—. A la base real
 * vuit d'onze perfils no en tenen: una columna plena d'icones grises diria
 * menys que una columna buida, i un enllaç a `wa.me/` sense número seria
 * justament l'enllaç trencat que es vol evitar. Qui té telèfon té botó.
 *
 * Sense missatge predefinit: obre la conversa buida.
 *
 * `variant`:
 *   · "button" — a la fitxa, al costat del correu i el telèfon. Amb etiqueta.
 *   · "icon"   — a les taules de clients. Només la icona, amb `title`/`aria-label`.
 */
export function WhatsAppLink({
  phone,
  name,
  variant = "button",
  className = "",
}: {
  phone: string | null | undefined;
  /** Nom de qui rep, només per a l'etiqueta accessible. */
  name?: string;
  variant?: "button" | "icon";
  className?: string;
}) {
  const number = whatsappNumber(phone);
  if (!number) return null;

  const label = name ? `Obrir WhatsApp amb ${name}` : "Obrir WhatsApp";

  // `noopener noreferrer` amb `_blank`: la pestanya nova no ha de poder tocar
  // aquesta ni saber d'on ve.
  const common = {
    href: `https://wa.me/${number}`,
    target: "_blank" as const,
    rel: "noopener noreferrer",
    title: label,
    "aria-label": label,
  };

  if (variant === "icon") {
    return (
      <a
        {...common}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-brand-bg active:bg-brand-border ${TAP} ${className}`}
      >
        <WhatsAppMark className="h-[18px] w-[18px]" />
      </a>
    );
  }

  return (
    <a
      {...common}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs font-bold tracking-wide whitespace-nowrap text-brand-charcoal uppercase hover:bg-brand-bg active:bg-brand-border ${TAP} ${className}`}
    >
      <WhatsAppMark className="h-4 w-4" />
      WhatsApp
    </a>
  );
}
