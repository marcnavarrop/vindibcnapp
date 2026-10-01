import Link from "next/link";
import { notFound } from "next/navigation";
import { TrainerForm } from "@/components/forms/trainer-form";
import { updateTrainerSpecialtyAction } from "@/app/(admin)/admin/entrenadors/actions";
import { getTrainer } from "@/lib/data/trainers";
import { avatarUrl } from "@/lib/data/avatars";
import { TAP } from "@/lib/utils";
import { TrainerEmailForm } from "@/components/forms/trainer-email-form";
import { getPendingEmailChange } from "@/lib/data/email-change";

export const dynamic = "force-dynamic";

export default async function EditTrainerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await getTrainer(id);
  if (!trainer) notFound();

  const [currentAvatar, pendingEmail] = await Promise.all([
    avatarUrl(trainer.avatarPath),
    getPendingEmailChange(id),
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
      </main>
  );
}
