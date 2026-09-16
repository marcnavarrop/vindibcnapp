"use client";

import { useMemo, useState } from "react";
import { TAP, clsx } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SERVICE_LABELS, BONO_STATUS_LABELS, formatEur, formatDate } from "@/lib/labels";
import { markTrainerBonoPaidAction } from "@/app/(trainer)/trainer/bonos/actions";
import { MarkBonoPaidButton } from "@/components/forms/mark-bono-paid-button";
import type { BonoListItem } from "@/lib/data/bonos";
import type { BonoStatus } from "@/types/database";

/**
 * Els bons del centre, vistos pel professional.
 *
 * POR QUÉ NO ÉS LA TAULA DE L'ADMIN AMB UN INTERRUPTOR
 *
 * Són dues taules perquè responen dues preguntes diferents. L'admin veu el
 * centre sencer i pot cobrar-ho tot; el professional veu el centre sencer per
 * coordinar-se però només cobra els seus. Encabir les dues a un sol component
 * demanaria una bandera per cada diferència —el conmutador "Els meus", quines
 * files porten botó, el text de la capçalera— i el resultat seria pitjor de
 * llegir que les dues per separat.
 *
 * El que SÍ que es comparteix és el que havia d'estar compartit: el botó de
 * cobrar amb el seu diàleg (`MarkBonoPaidButton`), que ja feien servir la taula
 * de l'admin i la fitxa del client. El dia que canviï què fa `markBonoPaid`,
 * les tres pantalles ho diran igual.
 *
 * ELS DOS FILTRES SÓN DE LA CASA
 *
 * El conmutador "Els meus / Tots" és el mateix de `TrainerClientsTable` i el
 * filtre per estat és el de `BonosAdminTable`. Es comença per "Els meus"
 * perquè és des d'on es pot fer alguna cosa: la vista de tot el centre és per
 * consultar, i qui la vulgui la té a un clic.
 */

const STATUS_TONE: Record<
  BonoStatus,
  "success" | "neutral" | "danger" | "warn"
> = {
  active: "success",
  completed: "neutral",
  cancelled: "danger",
  pending_payment: "warn",
  // Mateix criteri que a l'admin: caducat i anul·lat no són neutrals com
  // "completat", perquè hi ha sessions pagades que s'han perdut.
  expired: "danger",
  unpaid: "danger",
};

type Filter = "all" | "pending_payment" | "unpaid" | "active";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tots" },
  { key: "pending_payment", label: "Pendents de pagament" },
  { key: "unpaid", label: "Decaiguts sense cobrar" },
  { key: "active", label: "Actius" },
];

export function TrainerBonosTable({
  bonos,
  myClientIds,
  today,
}: {
  bonos: BonoListItem[];
  /** Els clients assignats a qui mira. Decideix quines files porten botó. */
  myClientIds: string[];
  /** Dia del CENTRE. Ve del servidor: el navegador pot anar en una altra zona. */
  today: string;
}) {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const mine = useMemo(() => new Set(myClientIds), [myClientIds]);

  /** Un bo és gestionable si el seu client és meu. La RLS ho torna a mirar. */
  const canCollect = (b: BonoListItem) =>
    mine.has(b.clientId) &&
    (b.status === "pending_payment" || b.status === "unpaid");

  // El comptador del filtre només compta el que jo puc cobrar: si digués 5 amb
  // 3 botons a la taula, el número estaria reclamant una feina que no és meva.
  const pendingCount = useMemo(
    () => bonos.filter((b) => b.status === "pending_payment" && mine.has(b.clientId)).length,
    [bonos, mine],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bonos
      .filter((b) => (scope === "mine" ? mine.has(b.clientId) : true))
      .filter((b) => filter === "all" || b.status === filter)
      .filter(
        (b) =>
          !q ||
          b.clientName.toLowerCase().includes(q) ||
          SERVICE_LABELS[b.serviceType].toLowerCase().includes(q),
      );
  }, [bonos, scope, mine, filter, query]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-brand-border bg-white p-0.5">
          {(["mine", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
                scope === s
                  ? "bg-brand-purple text-white"
                  : "text-brand-muted hover:text-brand-dark",
                TAP,
              )}
            >
              {s === "mine" ? "Els meus" : "Tots"}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per client o servei…"
          className="w-full max-w-sm rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
        />
        <span className="text-sm whitespace-nowrap text-brand-muted">
          {filtered.length} {filtered.length === 1 ? "bo" : "bons"}
        </span>
      </div>

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-brand-border bg-white p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
              filter === f.key
                ? "bg-brand-purple text-white"
                : "text-brand-muted hover:text-brand-dark",
              TAP,
            )}
          >
            {f.label}
            {f.key === "pending_payment" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-orange px-1.5 text-[10px] text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-brand-border bg-brand-bg">
            <tr className="text-xs tracking-wide text-brand-muted uppercase">
              <th className="px-4 py-3 font-bold">Client</th>
              <th className="px-4 py-3 font-bold">Servei</th>
              <th className="px-4 py-3 font-bold">Sessions</th>
              <th className="px-4 py-3 font-bold">Preu</th>
              <th className="px-4 py-3 font-bold">Caduca</th>
              <th className="px-4 py-3 font-bold">Estat</th>
              <th className="px-4 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr
                key={b.id}
                className="border-b border-brand-border last:border-0"
              >
                <td className="px-4 py-3 font-bold text-brand-dark">
                  {b.clientName}
                </td>
                <td className="px-4 py-3">{SERVICE_LABELS[b.serviceType]}</td>
                <td className="px-4 py-3">
                  <span className="font-bold text-brand-purple">
                    {b.remainingSessions}
                  </span>
                  <span className="text-brand-muted"> / {b.totalSessions}</span>
                  {b.status === "pending_payment" &&
                    b.totalSessions - b.remainingSessions > 0 && (
                      <span className="ml-2 text-xs font-bold text-brand-orange">
                        ({b.totalSessions - b.remainingSessions} ja consumides)
                      </span>
                    )}
                </td>
                <td className="px-4 py-3">{formatEur(b.price)}</td>
                <td className="px-4 py-3 text-brand-muted">
                  {b.expiresAt ? formatDate(b.expiresAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[b.status]}>
                    {BONO_STATUS_LABELS[b.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {/*
                    El botó només surt als bons dels clients propis. Veure el
                    bo d'un company és per coordinar-se —la 0005 obre el SELECT
                    a qualsevol professional a posta—, però cobrar-lo no: la
                    `bonos_trainer_write` ho comprova a la base amb
                    `is_trainer_of`, i l'acció de servidor ho torna a mirar
                    abans de llegir res.

                    A les files alienes es deixa el buit i prou. Un botó apagat
                    convidaria a insistir-hi, i el motiu —"aquest client no és
                    teu"— ja el diu la columna Client.
                  */}
                  {canCollect(b) && (
                    <MarkBonoPaidButton
                      action={markTrainerBonoPaidAction}
                      bonoId={b.id}
                      clientName={b.clientName}
                      serviceType={b.serviceType}
                      price={b.price}
                      remainingSessions={b.remainingSessions}
                      totalSessions={b.totalSessions}
                      status={b.status}
                      expired={!!b.expiresAt && b.expiresAt < today}
                    />
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-brand-muted"
                >
                  {scope === "mine"
                    ? "Cap bo teu en aquest filtre. Prova amb «Tots»."
                    : "Sense bons en aquest filtre."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
