"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteClientAction,
  deletionPreviewAction,
  type DeletionPreview,
  type FormState,
} from "@/app/(admin)/admin/clients/delete-actions";
import { TAP, TAP_SURFACE } from "@/lib/utils";

export function DeleteClientModal({
  clientId,
  clientName,
  open: controlledOpen,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  /**
   * Obert des de fora, sense el botó propi. La fitxa l'obre des del menú
   * «Més»: eliminar és infreqüent i irreversible, i no ha de tenir el mateix
   * pes que Editar a la capçalera.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;
  const setOpen = (v: boolean) =>
    controlled ? onOpenChange?.(v) : setOwnOpen(v);
  const [typed, setTyped] = useState("");
  const [state, formAction] = useActionState(
    deleteClientAction.bind(null, clientId),
    {} as FormState,
  );

  // L'historial clínic (0119): es mira en obrir la confirmació, no abans.
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPreview(null);
    deletionPreviewAction(clientId).then(
      (p) => alive && setPreview(p),
      () => alive && setPreview({ ok: false, error: "No s'ha pogut consultar l'historial clínic." }),
    );
    return () => {
      alive = false;
    };
  }, [open, clientId]);

  const matches =
    typed.trim().toLowerCase() === clientName.trim().toLowerCase();
  // Sense saber si té historial, no es deixa confirmar: la baixa l'ha d'arxivar.
  const ready = preview?.ok === true;

  return (
    <>
      {!controlled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          /*
           * `shrink-0 whitespace-nowrap` com els seus dos companys de fila.
           * Sense això era l'ÚNIC dels tres que podia encongir, així que
           * absorbia tota la compressió ell sol: el text es partia en dues
           * línies, el botó creixia a 58px d'alt contra els 38 dels altres i
           * l'`items-center` de la fila els descentrava a tots.
           */
          className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-error/40 bg-white px-4 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-error uppercase transition-colors hover:bg-error/10 ${TAP}`}
        >
          Eliminar client
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-brand-dark">
              Eliminar {clientName}
            </h2>
            <p className="mt-2 text-sm text-brand-muted">
              Aquesta acció és <strong>irreversible</strong>. S&apos;esborraran
              totes les dades personals del client i el seu accés
              (autenticació). Els pagaments es conserven de forma anonimitzada
              per obligació fiscal.
            </p>
            <ClinicalArchiveNotice preview={preview} />
            <p className="mt-3 text-sm text-brand-charcoal">
              Per confirmar, escriu el nom complet del client:{" "}
              <strong>{clientName}</strong>
            </p>

            <form action={formAction} className="mt-3 flex flex-col gap-3">
              <input
                name="confirmName"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={clientName}
                className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-error"
              />
              {state.error && (
                <p className="text-sm text-error">{state.error}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!matches || !ready}
                  className={`flex-1 rounded-lg bg-error px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${TAP_SURFACE}`}
                >
                  Eliminar definitivament
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold text-brand-muted hover:text-brand-dark ${TAP}`}
                >
                  Cancel·lar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Què passarà amb l'historial clínic. Si en té, es diu fins quan es conservarà
 * i hi ha el text per a la persona que ha demanat la supressió, en els tres
 * idiomes, per copiar-lo.
 */
function ClinicalArchiveNotice({ preview }: { preview: DeletionPreview | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (!preview)
    return (
      <p className="mt-3 text-sm text-brand-muted" data-clinical-archive="loading">
        Comprovant l&apos;historial clínic…
      </p>
    );
  if (!preview.ok)
    return (
      <p className="mt-3 text-sm text-error" data-clinical-archive="error">
        {preview.error} Sense això no es pot eliminar el client.
      </p>
    );
  if (!preview.archive)
    return (
      <p className="mt-3 text-sm text-brand-muted" data-clinical-archive="none">
        No té historial clínic de fisioteràpia: no s&apos;arxiva res.
      </p>
    );
  const { until, isDemo, texts } = preview.archive;
  const copy = async (locale: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(locale);
    } catch {
      setCopied(null);
    }
  };
  return (
    <div className="mt-3 flex flex-col gap-2" data-clinical-archive="archive">
      <p className="rounded-xl border border-attention bg-attention-bg px-3.5 py-2.5 text-sm text-attention">
        L&apos;historial clínic es conservarà fins al <strong>{until}</strong> (Llei 21/2000).
        {isDemo && " És un compte de demostració: s'arxiva marcat com a demo."}
      </p>
      <details className="text-sm text-brand-charcoal">
        <summary className="cursor-pointer font-bold text-brand-purple">
          Text per a la persona que ha demanat la supressió
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {texts.map((t) => (
            <li key={t.locale} className="rounded-lg border border-brand-border p-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-brand-muted uppercase">{t.locale}</span>
                <button
                  type="button"
                  onClick={() => copy(t.locale, t.text)}
                  className="text-xs font-bold text-brand-purple hover:underline"
                >
                  {copied === t.locale ? "Copiat ✓" : "Copiar"}
                </button>
              </div>
              <p className="text-xs leading-relaxed">{t.text}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
