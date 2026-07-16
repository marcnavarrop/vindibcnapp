import Link from "next/link";
import { TrainerForm } from "@/components/forms/trainer-form";
import { createTrainerAction } from "@/app/(admin)/admin/entrenadors/actions";

export default function NewTrainerPage() {
  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/entrenadors"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar
        </Link>
        <h1 className="mt-1 mb-2 text-2xl text-brand-dark">
          Nou entrenador/a
        </h1>
        <p className="mb-6 max-w-xl text-sm text-brand-muted">
          Es crea l&apos;usuari amb rol d&apos;entrenador/a i se li envia un
          correu d&apos;invitació perquè creï la seva contrasenya i pugui entrar.
        </p>

        <TrainerForm
          action={createTrainerAction}
          editableIdentity
          submitLabel="Crear entrenador/a"
          cancelHref="/admin/entrenadors"
        />
      </main>
  );
}
