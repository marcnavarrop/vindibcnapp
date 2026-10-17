import Link from "next/link";
import { notFound } from "next/navigation";
import { TrainerForm } from "@/components/forms/trainer-form";
import { updateTrainerSpecialtyAction } from "@/app/(admin)/admin/entrenadors/actions";
import { getTrainer } from "@/lib/data/trainers";
import { avatarUrl } from "@/lib/data/avatars";
import { TAP } from "@/lib/utils";
import { TrainerEmailForm } from "@/components/forms/trainer-email-form";
import { getPendingEmailChange } from "@/lib/data/email-change";
import { getViewer } from "@/lib/auth";
import { formatDate } from "@/lib/labels";
import { ReactivateProfessionalButton } from "@/components/reactivate-professional-button";

export const dynamic = "force-dynamic";

export default async function EditTrainerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await getTrainer(id);
  if (!trainer) notFound();

  const [currentAvatar, pendingEmail, viewer] = await Promise.all([
    avatarUrl(trainer.avatarPath),
    getPendingEmailChange(id),
    getViewer(),
  ]);
  const action = updateTrainerSpecialtyAction.bind(null, id);

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/entrenadors"
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
        >
          ← Tornar
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">
          Editar professional
        </h1>

        {trainer.deactivatedAt && (
          <section
            className="mb-6 rounded-2xl border border-brand-border bg-brand-bg/60 p-4 text-sm text-brand-charcoal"
            data-baixa="ja-de-baixa"
          >
            <p className="mb-3">
              <strong>Donat de baixa</strong> des del {formatDate(trainer.deactivatedAt)}: no pot entrar i no surt a
              l&apos;agenda ni als selectors.
            </p>
            <ReactivateProfessionalButton id={id} name={trainer.fullName} />
          </section>
        )}

        <TrainerForm
          action={action}
          editableIdentity={false}
          defaults={{
            fullName: trainer.fullName,
            email: trainer.email,
            specialty: trainer.specialty,
            avatarUrl: currentAvatar,
          }}
          submitLabel="Desar"
          cancelHref="/admin/entrenadors"
        />

        <TrainerEmailForm trainerId={id} currentEmail={trainer.email} pending={pendingEmail} />

        {/* Donar de baixa (0128): a la seva pàgina, on es veu tot el que en
            depèn abans de confirmar. Mai sobre un mateix. */}
        {!trainer.deactivatedAt && viewer?.id !== id && (
          <section className="mt-10 rounded-2xl border border-error/30 bg-white p-5" data-baixa="enllac">
            <h2 className="text-sm font-bold text-brand-dark">Donar de baixa</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Desactiva el professional: no podrà entrar i deixarà de sortir a l&apos;agenda. El seu historial es
              conserva i es pot reactivar.
            </p>
            <Link
              href={`/admin/entrenadors/${id}/baixa`}
              className={`mt-3 inline-flex rounded-lg border border-error/40 px-4 py-2 text-sm font-bold tracking-wide text-error uppercase hover:bg-error/10 ${TAP}`}
            >
              Donar de baixa
            </Link>
          </section>
        )}
      </main>
  );
}
