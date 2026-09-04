import Link from "next/link";
import { PromotionForm } from "@/components/forms/promotion-form";
import { listActiveServices } from "@/lib/data/services";
import { listClientTags } from "@/lib/data/client-tags";
import { createOfertaAction } from "@/app/(admin)/admin/ofertes/actions";
import { TAP } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewOfertaPage() {
  const [services, tags] = await Promise.all([
    listActiveServices(),
    listClientTags(),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link
        href="/admin/ofertes"
        className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
      >
        ← Tornar a ofertes
      </Link>
      <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Nova oferta</h1>
      <PromotionForm
        action={createOfertaAction}
        cancelHref="/admin/ofertes"
        services={services}
        tags={tags}
      />
    </main>
  );
}
