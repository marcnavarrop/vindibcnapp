import { listSupportTickets } from "@/lib/data/support";
import { SupportPanel } from "@/components/support-panel";
import {
  createTicketAdminAction,
  setTicketStatusAction,
} from "@/app/(admin)/admin/suport/actions";

export const dynamic = "force-dynamic";

export default async function AdminSuportPage() {
  const tickets = await listSupportTickets();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl text-brand-dark">Suport</h1>
      <p className="mb-6 text-sm text-brand-muted">
        Errors, dubtes i idees sobre l&apos;app. Veus els tiquets de tot
        l&apos;equip i pots canviar-ne l&apos;estat.
      </p>

      <SupportPanel
        tickets={tickets}
        createAction={createTicketAdminAction}
        setStatusAction={setTicketStatusAction}
      />
    </main>
  );
}
