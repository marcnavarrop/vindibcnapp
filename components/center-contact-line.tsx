"use client";

import { createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import { displayPhone, hasContact, telHref, whatsappHref, type PublicContact } from "@/lib/center-contact";
import { clsx } from "@/lib/utils";

/*
 * EL CONTACTE DEL CENTRE A LES PANTALLES.
 *
 * El llegeix el servidor un sol cop (AppShell, i els layouts de /prova i de
 * l'accés) i el posa en aquest context: qualsevol pantalla el pot pintar sense
 * cap consulta més. Només hi va la part pública (telèfon, WhatsApp, correu i
 * adreça); el correu dels avisos interns i les dades legals no surten del
 * servidor.
 *
 * Buit vol dir que no es pinta res: ni una línia buida ni un text provisional.
 */

const Ctx = createContext<PublicContact | null>(null);

export function CenterContactProvider({
  contact,
  children,
}: {
  contact: PublicContact;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={contact}>{children}</Ctx.Provider>;
}

export function useCenterContact(): PublicContact | null {
  return useContext(Ctx);
}

const LINK = "font-bold text-brand-purple underline decoration-brand-purple/30 underline-offset-2 hover:text-brand-purple-light";

/**
 * «931 23 45 67 (WhatsApp) · recepcio@…», amb enllaços: tel:, wa.me i mailto:.
 * Sense res, no pinta res.
 */
export function ContactLinks({
  contact,
  whatsappLabel = "WhatsApp",
}: {
  contact: PublicContact;
  whatsappLabel?: string;
}) {
  if (!hasContact(contact)) return null;
  return (
    <span data-contact-links>
      {contact.phone && (
        <>
          <a href={telHref(contact.phone)} className={LINK} data-contact-tel>
            {displayPhone(contact.phone)}
          </a>
          {contact.whatsapp && (
            <>
              {" ("}
              <a href={whatsappHref(contact.phone)} target="_blank" rel="noopener noreferrer" className={LINK} data-contact-wa>
                {whatsappLabel}
              </a>
              {")"}
            </>
          )}
        </>
      )}
      {contact.phone && contact.email && " · "}
      {contact.email && (
        <a href={`mailto:${contact.email}`} className={clsx(LINK, "break-all")} data-contact-mail>
          {contact.email}
        </a>
      )}
    </span>
  );
}

/**
 * La línia «Contacte del centre: …» per sota d'un avís que diu «parla amb el
 * centre». Sense contacte configurat, no surt.
 */
export function CenterContactLine({ className }: { className?: string }) {
  const contact = useCenterContact();
  const t = useTranslations("contact");
  if (!contact || !hasContact(contact)) return null;
  return (
    <p className={clsx("text-sm text-brand-charcoal", className)} data-center-contact>
      <span className="text-brand-muted">{t("label")}: </span>
      <ContactLinks contact={contact} whatsappLabel={t("whatsapp")} />
    </p>
  );
}
