"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreMenu } from "@/components/ui/more-menu";
import { DeleteClientModal } from "@/components/delete-client-modal";
import {
  resendInviteAction,
  type NotificationActionResult,
} from "@/app/actions/client-notification-actions";
import { TAP } from "@/lib/utils";

const LINK = `text-xs font-bold tracking-wide text-brand-purple uppercase hover:text-brand-purple-dark hover:underline ${TAP}`;

/**
 * «Professional: Laia Puig · canviar». El selector de sempre (`AssignTrainerForm`,
 * que arriba com a `form`) només surt en tocar «canviar».
 */
export function TrainerLine({
  trainerName,
  form,
}: {
  trainerName: string | null;
  form?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-2">
        <span>
          Professional:{" "}
          <b className="font-bold text-brand-charcoal">{trainerName ?? "sense assignar"}</b>
        </span>
        {form && (
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={LINK}>
            {open ? "Tancar" : "Canviar"}
          </button>
        )}
      </p>
      {open && form && (
        <div className="max-w-sm rounded-2xl border border-brand-border bg-white p-4">{form}</div>
      )}
    </div>
  );
}

/**
 * «+ Etiqueta»: obre el panell d'etiquetes de sempre (`ClientTagsPanel`, que
 * arriba com a `children`) just a sota de la capçalera.
 */
export function TagsEditor({ children, hasTags }: { children: React.ReactNode; hasTags: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-7 items-center rounded-full border border-dashed border-brand-border px-2.5 text-xs font-bold text-brand-tab hover:border-brand-purple hover:text-brand-purple ${TAP}`}
      >
        {open ? "Tancar etiquetes" : hasTags ? "Etiquetes" : "+ Etiqueta"}
      </button>
      {open && <div className="basis-full pt-1">{children}</div>}
    </>
  );
}

/**
 * «Més ▾» de la fitxa. Cada opció fa el que feia el seu botó d'abans: Editar i
 * Exportar hi naveguen, Eliminar obre la mateixa confirmació (cal escriure el
 * nom) i Reenviar la invitació diu aquí mateix si ha anat bé.
 */
export function ClientFileMenu({
  clientId,
  clientName,
  editHref,
  exportHref,
  canDelete = false,
}: {
  clientId: string;
  clientName: string;
  editHref?: string;
  exportHref?: string;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<NotificationActionResult | null>(null);

  const items = [
    ...(editHref ? [{ label: "Editar dades", onSelect: () => router.push(editHref) }] : []),
    // Una descàrrega, no una pantalla: per això no és `router.push`.
    ...(exportHref ? [{ label: "Exportar dades", onSelect: () => window.location.assign(exportHref) }] : []),
    {
      label: "Reenviar invitació",
      onSelect: () => {
        setResult(null);
        startTransition(async () => setResult(await resendInviteAction(clientId)));
      },
    },
    ...(canDelete ? [{ label: "Eliminar client", danger: true, onSelect: () => setDeleting(true) }] : []),
  ];

  return (
    <div className="flex flex-col items-end gap-1">
      <MoreMenu items={items} />
      {(pending || result) && (
        <p
          role="status"
          className={`max-w-[12rem] text-right text-xs font-bold ${pending ? "text-brand-muted" : result?.ok ? "text-success" : "text-error"}`}
        >
          {pending ? "Enviant la invitació…" : `${result?.ok ? "✓" : "✗"} ${result?.message}`}
        </p>
      )}
      {canDelete && (
        <DeleteClientModal clientId={clientId} clientName={clientName} open={deleting} onOpenChange={setDeleting} />
      )}
    </div>
  );
}
