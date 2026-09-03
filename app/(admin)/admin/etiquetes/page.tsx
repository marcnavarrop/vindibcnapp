import { GroupTabs } from "@/components/ui/group-tabs";
import { TagCatalog } from "@/components/forms/tag-catalog";
import { listClientTagsWithUsage } from "@/lib/data/client-tags";
import {
  createTagAction,
  renameTagAction,
  deleteTagAction,
} from "@/app/(admin)/admin/etiquetes/actions";

const TABS = [
  { href: "/admin/serveis", label: "Serveis" },
  { href: "/admin/ofertes", label: "Ofertes" },
  { href: "/admin/etiquetes", label: "Etiquetes" },
];

export const dynamic = "force-dynamic";

export default async function EtiquetesPage() {
  const tags = await listClientTagsWithUsage();

  return (
    <>
      <GroupTabs tabs={TABS} />
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl text-brand-dark">Etiquetes de client</h1>
        <p className="mt-1 mb-6 text-sm text-brand-muted">
          Text lliure, per agrupar clients i dirigir-los ofertes. S&apos;assignen
          des de la fitxa de cada client, i el client no les veu mai.
        </p>

        <TagCatalog
          tags={tags}
          createAction={createTagAction}
          renameAction={renameTagAction}
          deleteAction={deleteTagAction}
        />
      </main>
    </>
  );
}
