import { getTranslations } from "next-intl/server";
import { NotFoundPanel } from "@/components/not-found-panel";

/** «No existeix» dins de l'àrea del client, en el seu idioma i amb el menú. */
export default async function ClientNotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <NotFoundPanel title={t("title")} body={t("body")} backHref="/client" backLabel={t("back")} />
    </main>
  );
}
