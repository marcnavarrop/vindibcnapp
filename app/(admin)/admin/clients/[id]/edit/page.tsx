import { demoAssignmentAllowed } from "@/lib/demo-accounts";
import { getDemoWorld } from "@/lib/data/demo-world";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/forms/client-form";
import { getClient, listTrainers } from "@/lib/data/clients";
import { updateClientAction } from "@/app/(admin)/admin/clients/actions";
import { TAP } from "@/lib/utils";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, trainers, world] = await Promise.all([
    getClient(id),
    listTrainers(),
    getDemoWorld(),
  ]);
  if (!client) notFound();

  return (
      <main className="mx-auto max-w-5xl p-6">
        <Link
          href={`/admin/clients/${id}`}
          className={`text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple ${TAP}`}
        >
          ← Tornar a la fitxa
        </Link>
        <h1 className="mt-1 mb-6 text-2xl text-brand-dark">Editar client</h1>

        <ClientForm
          action={updateClientAction.bind(null, id)}
          // Demo amb demo (`demoAssignmentAllowed`): no s'ofereix el que es rebutjaria.
          trainers={trainers.filter((t) => demoAssignmentAllowed(world, id, t.id))}
          // Editant algú que ja existeix: el correu es veu però no es toca.
          editableEmail={false}
          submitLabel="Desar canvis"
          cancelHref={`/admin/clients/${id}`}
          defaults={{
            fullName: client.fullName,
            email: client.email,
            phone: client.phone ?? "",
            assignedTrainerId: client.assignedTrainerId ?? "",
            generalNotes: client.generalNotes ?? "",
          }}
        />
      </main>
  );
}
