import Link from "next/link";
import { AnnouncementForm } from "@/components/forms/announcement-form";
import { createAnnouncementAction } from "@/app/(admin)/admin/community/actions";
import { TAP } from "@/lib/utils";

export default function NewAnnouncementPage() {
  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/community"
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
        >
          ← Comunitat
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nova publicació</h1>

        <AnnouncementForm
          action={createAnnouncementAction}
          submitLabel="Publicar"
        />
      </main>
  );
}

// El correu als apuntats a la comunitat s'envia a `after()`, dins d'aquesta
// mateixa funció: 300 s (el màxim del pla Hobby amb Fluid) donen per a molts
// més lots dels que calen (cada lot de 100 tarda ~1 s).
export const maxDuration = 300;
