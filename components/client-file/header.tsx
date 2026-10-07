import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { HealthConsentWarning } from "@/components/health-consent-warning";
import { TAP, whatsappNumber } from "@/lib/utils";
import type { ClientTag } from "@/lib/data/client-tags";

/** Els botons de contacte: la mateixa alçada que el de WhatsApp. */
const CONTACT_BTN = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-brand-border bg-white px-2.5 text-xs font-bold tracking-wide whitespace-nowrap text-brand-charcoal uppercase hover:bg-brand-bg active:bg-brand-border ${TAP}`;

/**
 * LA CAPÇALERA DE LA FITXA DEL CLIENT, la mateixa a l'administració i al
 * professional. Cada pàgina li passa les peces que li toquen (el menú, el
 * selector de professional, les etiquetes) i aquí només es decideix l'ordre:
 *
 * 1. Qui és i qui el porta, amb «canviar» al costat: reassignar és poc
 *    freqüent i abans ocupava un terç del Resum amb el seu «Desar».
 * 2. Les etiquetes, perquè dirigeixen ofertes i canvien el preu que veu.
 * 3. Contactar, a un toc: WhatsApp, trucar i correu.
 * 4. Si és d'un altre professional, una línia que ho diu.
 * 5. L'avís de consentiment, curt; el detall es desplega.
 *
 * Les accions sobre la fitxa (editar, exportar, eliminar) van al menú «Més» de
 * la dreta: eliminar, que és irreversible, ja no té el pes d'Editar.
 */
export function ClientFileHeader({
  backHref,
  fullName,
  email,
  phone,
  trainerLine,
  tags,
  tagsEditor,
  menu,
  notice,
  needsHealthConsent,
}: {
  backHref: string;
  fullName: string;
  email: string;
  phone: string | null;
  /** «Professional: … · canviar». */
  trainerLine: React.ReactNode;
  tags: ClientTag[];
  /** El botó que obre el panell d'etiquetes, si qui mira en pot posar. */
  tagsEditor?: React.ReactNode;
  menu?: React.ReactNode;
  /** La línia de la fitxa d'un client que no és seu. */
  notice?: React.ReactNode;
  needsHealthConsent: boolean;
}) {
  const number = whatsappNumber(phone);
  return (
    <header className="flex flex-col gap-3">
      {/*
        `min-w-0` a la columna del nom: sense ell, un correu llarg imposa la
        seva amplada mínima i, a 375 px, arrossega la pàgina sencera de costat.
      */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={backHref}
            className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
          >
            ← Clients
          </Link>
          <h1 className="mt-1 text-2xl break-words text-brand-dark">{fullName}</h1>
          <div className="mt-0.5 text-sm text-brand-muted">{trainerLine}</div>
        </div>
        {menu && <div className="shrink-0">{menu}</div>}
      </div>

      {(tags.length > 0 || tagsEditor) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {/*
            L'únic Badge amb text que no controlem: el nom de l'etiqueta
            l'escriu l'admin i no té sostre. Es talla amb punts suspensius i el
            nom sencer queda al `title`.
          */}
          {tags.map((t) => (
            <Badge key={t.id} tone="info" className="max-w-full truncate" title={t.name}>
              {t.name}
            </Badge>
          ))}
          {tagsEditor}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {/* Les dades, seleccionables: de vegades cal copiar-les, no trucar. */}
        <p className="text-sm break-words text-brand-muted">
          {email}
          {phone ? ` · ${phone}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <WhatsAppLink phone={phone} name={fullName} className="h-9" />
          {number && (
            <a href={`tel:+${number}`} className={CONTACT_BTN} aria-label={`Trucar a ${fullName}`}>
              <Phone aria-hidden className="h-4 w-4" />
              Trucar
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className={CONTACT_BTN} aria-label={`Escriure un correu a ${fullName}`}>
              <Mail aria-hidden className="h-4 w-4" />
              Correu
            </a>
          )}
        </div>
      </div>

      {notice}
      {needsHealthConsent && <HealthConsentWarning />}
    </header>
  );
}
