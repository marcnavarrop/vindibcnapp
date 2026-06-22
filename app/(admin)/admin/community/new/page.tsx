import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { AnnouncementForm } from "@/components/forms/announcement-form";
import { createAnnouncementAction } from "@/app/(admin)/admin/community/actions";

export default function NewAnnouncementPage() {
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
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nova publicació</h1>

        <AnnouncementForm
          action={createAnnouncementAction}
          submitLabel="Publicar"
        />
      </main>
    </div>
  );
}
