import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { GroupTabs } from "@/components/ui/group-tabs";
import { ArchiveIntro, ArchiveList } from "@/components/clinical-archive/archive-views";
import { listArchivedPatients } from "@/lib/data/clinical-archive";
import { PERSONES_TABS } from "@/lib/admin-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arxiu clínic" };

/** L'arxiu clínic (0119): els pacients donats de baixa amb historial de fisio. */
export default async function AdminClinicalArchivePage() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") redirect("/admin");
  const patients = await listArchivedPatients(viewer);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <GroupTabs tabs={PERSONES_TABS} />
      <h1 className="text-2xl text-brand-dark">Arxiu clínic</h1>
      <ArchiveIntro />
      <ArchiveList patients={patients} basePath="/admin/arxiu-clinic" />
    </main>
  );
}
