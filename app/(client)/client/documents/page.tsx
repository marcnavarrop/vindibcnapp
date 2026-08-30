import { getViewer } from "@/lib/auth";
import { getClientByProfile } from "@/lib/data/clients";
import { listClientDocuments } from "@/lib/data/client-documents";
import { DocumentsClientPanel } from "@/components/documents-client-panel";
import {
  uploadDocumentAction,
  deleteDocumentAction,
} from "@/app/(client)/client/documents/actions";
import { assertModuleEnabled } from "@/lib/data/module-guard";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsPage() {
  await assertModuleEnabled("documents");
  const t = await getTranslations("documents");
  const viewer = await getViewer();
  const client = viewer ? await getClientByProfile(viewer.id) : null;
  const documents = client ? await listClientDocuments(client.id) : [];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">{t("title")}</h1>
      <p className="mb-6 text-sm text-brand-muted">{t("intro")}</p>
      {client ? (
        <DocumentsClientPanel
          documents={documents}
          uploadAction={uploadDocumentAction}
          deleteAction={deleteDocumentAction}
        />
      ) : (
        <p className="rounded-2xl border border-brand-border bg-white p-6 text-sm text-brand-muted">
          {t("noClientRecord")}
        </p>
      )}
    </main>
  );
}
