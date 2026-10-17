import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { ArchiveRecord } from "@/components/clinical-archive/archive-views";
import { canReadClinicalArchive, getArchivedPatient } from "@/lib/data/clinical-archive";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arxiu clínic" };

/** La fitxa d'un pacient arxivat per al fisio: només lectura, sense exportar. */
export default async function TrainerClinicalArchiveRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !canReadClinicalArchive(viewer)) redirect("/trainer");
  const { id } = await params;
  const patient = await getArchivedPatient(id, viewer);
  if (!patient) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <ArchiveRecord patient={patient} basePath="/trainer/arxiu-clinic" />
    </main>
  );
}
