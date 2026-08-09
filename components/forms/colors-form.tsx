"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";
import { updateColorsAction } from "@/app/(admin)/admin/configuracio/colors-actions";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/labels";
import { PRO_PALETTE } from "@/lib/pro-colors";
import type { ColorPalette } from "@/lib/colors";
import type { ServiceType } from "@/types/database";

export type ColorPro = { id: string; name: string; avatarUrl: string | null };

/** Bloc temàtic, igual que a la configuració del centre. */
function Group({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-brand-border pt-4">
      <p className="text-sm font-bold tracking-wide text-brand-purple uppercase">
        {title}
      </p>
      <p className="mt-0.5 mb-4 text-xs text-brand-muted">{desc}</p>
      <div className="ml-1 flex flex-col gap-3 border-l-2 border-brand-purple/30 pl-5">
        {children}
      </div>
    </div>
  );
}

/**
 * Una fila de la paleta: mostra a l'esquerra COM queda i a la dreta com es
 * canvia.
 *
 * La vista prèvia no és un quadrat de color sol: reprodueix la pastilla del
 * calendari (fons tenyit al 10% i barra lateral opaca), que és exactament com
 * es veurà. Un color pot semblar bo com a taca i quedar il·legible com a fons
 * d'un text petit, i això només es veu si es mira igual que al seu lloc.
 */
function ColorRow({
  name,
  label,
  value,
  onChange,
  preview,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  preview?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2"
        style={{
          backgroundColor: `${value}1a`,
          borderLeft: `3px solid ${value}`,
        }}
      >
        {preview}
        <span className="truncate text-sm font-bold text-brand-dark">
          {label}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* El text porta el valor real; el selector només és la manera còmoda
            de triar-lo. Així es pot enganxar un hex de marca exacte. */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Codi del color de ${label}`}
          spellCheck={false}
          className="w-24 rounded-lg border border-brand-border px-2 py-1.5 font-mono text-xs text-brand-dark focus:border-brand-purple focus:outline-none"
        />
        <input
          type="color"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Color de ${label}`}
          className="h-9 w-11 cursor-pointer rounded-lg border border-brand-border bg-white p-1"
        />
      </div>
    </div>
  );
}

export function ColorsForm({
  palette,
  professionals,
}: {
  palette: ColorPalette;
  professionals: ColorPro[];
}) {
  const [state, formAction] = useActionState(updateColorsAction, {});

  const [services, setServices] = useState<Record<ServiceType, string>>(
    palette.services,
  );
  const [pros, setPros] = useState<Record<string, string>>(palette.pros);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <p className="text-sm text-brand-muted">
        Els colors dels calendaris. Els dels serveis pinten les reserves a
        l&apos;agenda de l&apos;equip; els dels professionals, les franges de
        disponibilitat i el calendari del client.
      </p>

      <Group
        title="Tipus de servei"
        desc="Color de cada servei a l'agenda de l'equip i a la compra de bons."
      >
        {SERVICE_TYPES.map((t) => (
          <ColorRow
            key={t}
            name={`svc:${t}`}
            label={SERVICE_LABELS[t]}
            value={services[t]}
            onChange={(v) => setServices((s) => ({ ...s, [t]: v }))}
          />
        ))}
      </Group>

      <Group
        title="Professionals"
        desc="Color de cada professional al calendari del client i a les capes de disponibilitat."
      >
        {professionals.length === 0 ? (
          <p className="text-sm text-brand-muted">
            Encara no hi ha professionals.
          </p>
        ) : (
          professionals.map((p) => (
            <ColorRow
              key={p.id}
              name={`pro:${p.id}`}
              label={p.name}
              value={pros[p.id] ?? PRO_PALETTE[0]}
              onChange={(v) => setPros((s) => ({ ...s, [p.id]: v }))}
              preview={
                <Avatar
                  name={p.name}
                  url={p.avatarUrl}
                  size={20}
                  color={pros[p.id] ?? PRO_PALETTE[0]}
                />
              }
            />
          ))
        )}
      </Group>

      {state.error && <p className="text-sm text-error">{state.error}</p>}
      {state.ok && (
        <p className="text-sm text-success">Colors desats correctament.</p>
      )}

      <div className="flex items-center gap-4">
        <SubmitButton>Desar colors</SubmitButton>
        <button
          type="button"
          onClick={() => {
            setServices(palette.services);
            setPros(palette.pros);
          }}
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          Desfer els canvis
        </button>
      </div>
    </form>
  );
}
