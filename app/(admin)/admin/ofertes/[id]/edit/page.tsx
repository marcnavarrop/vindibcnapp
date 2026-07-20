import Link from "next/link";
import { notFound } from "next/navigation";
import { PromotionForm } from "@/components/forms/promotion-form";
import { getPromotion } from "@/lib/data/promotions";
import { listActiveServices } from "@/lib/data/services";
import { updateOfertaAction } from "@/app/(admin)/admin/ofertes/actions";

export const dynamic = "force-dynamic";

export default async function EditOfertaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [promotion, services] = await Promise.all([
    getPromotion(id),
    listActiveServices(),
  ]);
  if (!promotion) notFound();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Link
        href="/admin/ofertes"
        className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
      >
        ← Tornar a ofertes
      </Link>
      <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Editar oferta</h1>
      <PromotionForm
        action={updateOfertaAction.bind(null, id)}
        cancelHref="/admin/ofertes"
        services={services}
        initial={promotion}
      />
    </main>
  );
}
