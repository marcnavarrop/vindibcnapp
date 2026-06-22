import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { AnnouncementForm } from "@/components/forms/announcement-form";
import { getAnnouncement } from "@/lib/data/announcements";
import { updateAnnouncementAction } from "@/app/(admin)/admin/community/actions";

export const dynamic = "force-dynamic";

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) notFound();

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardHeader area="Administració" home="/admin" />
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/community"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Comunitat
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Editar publicació</h1>

        <AnnouncementForm
          action={updateAnnouncementAction.bind(null, id)}
          submitLabel="Desar canvis"
          defaults={{ title: announcement.title, body: announcement.body }}
        />
      </main>
    </div>
  );
}
