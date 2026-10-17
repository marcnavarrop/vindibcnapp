import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { ArchiveRecord } from "@/components/clinical-archive/archive-views";
import { getArchivedPatient } from "@/lib/data/clinical-archive";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arxiu clínic" };

/** La fitxa d'un pacient arxivat, en només lectura. Obrir-la queda registrat. */
export default async function AdminClinicalArchiveRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") redirect("/admin");
  const { id } = await params;
  const patient = await getArchivedPatient(id, viewer);
  if (!patient) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <ArchiveRecord patient={patient} basePath="/admin/arxiu-clinic" exportHref={`/admin/arxiu-clinic/${id}/export`} />
    </main>
  );
}
