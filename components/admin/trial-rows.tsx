"use client";

import Link from "next/link";
import { SERVICE_LABELS } from "@/lib/labels";
import {
  acceptTrialAdminAction,
  loadMoreTrialsAction,
  rejectTrialAdminAction,
  setTrialStatusAdminAction,
} from "@/app/(admin)/admin/prova/actions";
import { LoadMoreFooter, useLoadMore } from "@/components/server-list";
import type { TrialRowView } from "@/lib/trial-row";
import type { TrialStatus } from "@/types/database";
import { TAP } from "@/lib/utils";
import { Badge, type BadgeIcon, type BadgeTone } from "@/components/ui/badge";

/**
 * Les files de /admin/prova, ara al navegador perquè l'històric creix amb
 * «Carregar més». L'hora arriba ja escrita del servidor (`toTrialRowView`).
 */

const STATUS_LABELS: Record<TrialStatus, string> = {
  pending: "Pendent",
  confirmed: "Confirmada",
  rejected: "Rebutjada",
  expired: "Caducada",
  completed: "Completada",
  no_show: "No presentat",
  cancelled: "Cancel·lada",
};

// La pendent, amb el rellotge de sorra: és la mateixa prova pendent que
// l'agenda pinta en blau d'atenció (pas 7).
const STATUS_LOOK: Record<TrialStatus, { tone: BadgeTone; icon?: BadgeIcon }> = {
  pending: { tone: "attention", icon: "pending" },
  confirmed: { tone: "info" },
  rejected: { tone: "danger" },
  expired: { tone: "neutral" },
  completed: { tone: "success" },
  no_show: { tone: "danger" },
  cancelled: { tone: "neutral" },
};

/** L'històric, per pàgines: de la prova més recent a la més antiga. */
export function TrialHistory({
  initialRows,
  initialCursor,
  total,
}: {
  initialRows: TrialRowView[];
  initialCursor: string | null;
  total: number | null;
}) {
  const list = useLoadMore(initialRows, initialCursor, loadMoreTrialsAction);
  return (
    <>
      <div className="divide-y divide-brand-border" data-testid="trial-history">
        {list.items.length === 0 ? (
          <p className="px-5 py-4 text-sm text-brand-muted">Res a l&apos;històric.</p>
        ) : (
          list.items.map((t) => <TrialRow key={t.id} t={t} />)
        )}
      </div>
      {list.items.length > 0 && (
        <div className="border-t border-brand-border px-5 pb-3">
          <LoadMoreFooter
            shown={list.items.length}
            total={total}
            noun="proves"
            hasMore={list.hasMore}
            pending={list.pending}
            error={list.error}
            onLoadMore={list.loadMore}
          />
        </div>
      )}
    </>
  );
}

export function TrialRow({ t }: { t: TrialRowView }) {
  const canAct = t.status === "pending" || t.status === "confirmed";
  const canConvert = t.status !== "rejected" && !t.convertedClientId;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
      <div className="min-w-[10rem] flex-1">
        <div className="font-bold text-brand-dark">{t.fullName}</div>
        <div className="text-xs text-brand-muted">
          <a href={`tel:${t.phone}`} className={`hover:text-brand-purple ${TAP}`}>
            {t.phone}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${t.email}`} className={`hover:text-brand-purple ${TAP}`}>
            {t.email}
          </a>
        </div>
      </div>
      <div className="text-brand-muted">
        {t.when}
        <span className="block text-xs">
          {t.trainerName ?? "—"} · {SERVICE_LABELS[t.serviceType]}
        </span>
      </div>
      <Badge tone={STATUS_LOOK[t.status].tone} icon={STATUS_LOOK[t.status].icon}>
        {STATUS_LABELS[t.status]}
        {t.convertedClientId && " · client"}
      </Badge>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {t.status === "pending" && (
          <form action={acceptTrialAdminAction}>
            <input type="hidden" name="id" value={t.id} />
            <button
              type="submit"
              className={`rounded-md bg-brand-purple px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-purple-light ${TAP}`}
            >
              Acceptar
            </button>
          </form>
        )}
        {canAct && (
          <form action={rejectTrialAdminAction}>
            <input type="hidden" name="id" value={t.id} />
            <button
              type="submit"
              className={`rounded-md border border-brand-border px-2.5 py-1.5 text-xs font-bold text-error hover:bg-error/10 ${TAP}`}
            >
              Rebutjar
            </button>
          </form>
        )}
        {t.status === "confirmed" && (
          <>
            <StatusButton id={t.id} status="completed" label="Completada" />
            <StatusButton id={t.id} status="no_show" label="No presentat" />
            <StatusButton id={t.id} status="cancelled" label="Cancel·lar" />
          </>
        )}
        {canConvert && (
          <Link
            href={`/admin/clients/new?trial=${t.id}`}
            className={`rounded-md bg-brand-orange px-2.5 py-1.5 text-xs font-bold text-white hover:opacity-90 ${TAP}`}
          >
            Convertir en client
          </Link>
        )}
      </div>
    </div>
  );
}

function StatusButton({
  id,
  status,
  label,
}: {
  id: string;
  status: TrialStatus;
  label: string;
}) {
  return (
    <form action={setTrialStatusAdminAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={`rounded-md border border-brand-border px-2.5 py-1.5 text-xs font-bold text-brand-muted hover:text-brand-dark ${TAP}`}
      >
        {label}
      </button>
    </form>
  );
}
