import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { ArchiveIntro, ArchiveList } from "@/components/clinical-archive/archive-views";
import { canReadClinicalArchive, listArchivedPatients } from "@/lib/data/clinical-archive";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arxiu clínic" };

/** L'arxiu clínic per als fisios (0119): en lectura, i només el seu món (demo o real). */
export default async function TrainerClinicalArchivePage() {
  const viewer = await getViewer();
  if (!viewer || !canReadClinicalArchive(viewer)) redirect("/trainer");
  const patients = await listArchivedPatients(viewer);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl text-brand-dark">Arxiu clínic</h1>
      <ArchiveIntro />
      <ArchiveList patients={patients} basePath="/trainer/arxiu-clinic" />
    </main>
  );
}
