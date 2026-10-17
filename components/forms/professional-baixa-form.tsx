"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  deactivateProfessionalAction,
  type BaixaState,
} from "@/app/(admin)/admin/entrenadors/baixa-actions";
import { TAP, TAP_SURFACE } from "@/lib/utils";

/**
 * La confirmació de «Donar de baixa» (0128): a qui passen els clients i el nom
 * escrit. En acabar, l'acció torna a la mateixa pàgina, que ja diu què s'ha fet.
 */
export function ProfessionalBaixaForm({
  id,
  name,
  clientCount,
  targets,
}: {
  id: string;
  name: string;
  clientCount: number;
  targets: { id: string; name: string }[];
}) {
  const [typed, setTyped] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [state, formAction, pending] = useActionState(
    deactivateProfessionalAction.bind(null, id),
    {} as BaixaState,
  );

  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();
  const chosen = clientCount === 0 || reassignTo !== "";

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4 rounded-2xl border border-error/30 bg-white p-5">
      {clientCount > 0 && (
        <label className="flex flex-col gap-1 text-sm text-brand-charcoal">
          <span className="font-bold">
            {clientCount === 1 ? "El seu client passa" : `Els seus ${clientCount} clients passen`} a:
          </span>
          <select
            name="reassignTo"
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
            className="w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-purple sm:w-auto"
          >
            <option value="">Tria…</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="none">Sense professional</option>
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm text-brand-charcoal">
        <span>
          Per confirmar, escriu el nom complet: <strong>{name}</strong>
        </span>
        <input
          name="confirmName"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder={name}
          className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-error"
        />
      </label>

      {state.error && (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!matches || !chosen || pending}
          className={`rounded-lg bg-error px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${TAP_SURFACE}`}
        >
          {pending ? "Donant de baixa…" : "Donar de baixa"}
        </button>
        <Link
          href={`/admin/entrenadors/${id}/edit`}
          className={`text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP}`}
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
