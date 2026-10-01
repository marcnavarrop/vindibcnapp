"use client";

import { useTranslations } from "next-intl";
import { AddToCalendarButton } from "@/components/ui/add-to-calendar-button";
import type { ServiceType } from "@/types/database";

/**
 * «Afegir al calendari» a l'àrea del client: el botó, les opcions i
 * l'esdeveniment que queda al seu calendari, en el seu idioma.
 *
 * El botó de base és compartit amb l'admin i el professional, que treballen
 * en català fix i no tenen diccionari carregat; per això els textos li arriben
 * ja traduïts des d'aquí.
 */
export function ClientAddToCalendarButton(props: {
  serviceType: ServiceType;
  otherPartyName: string | null;
  scheduledAt: string;
  className?: string;
  touch?: boolean;
}) {
  const t = useTranslations("labels.calendar");
  const tl = useTranslations("labels.service");
  const service = tl(props.serviceType);
  const name = props.otherPartyName;
  return (
    <AddToCalendarButton
      {...props}
      text={{
        button: t("button"),
        other: t("other"),
        file: t("file"),
        title: name ? t("titleWith", { service, name }) : t("title", { service }),
        description: name
          ? t("descriptionWith", { service, name })
          : t("description", { service }),
      }}
    />
  );
}
