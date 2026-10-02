"use client";

import { useEffect, useState } from "react";
import { clearUndo, useUndoToast } from "@/lib/undo-toast";
import { TAP } from "@/lib/utils";

/** Quant de temps es pot desfer. Prou per adonar-se'n; poc per no fer nosa. */
const SECONDS = 8;

/**
 * Pinta l'avís «… · Desfer» (vegeu `lib/undo-toast.ts`). Un de sol a la vegada:
 * un esborrat nou substitueix l'anterior, que ja no es podrà desfer d'aquí.
 *
 * Es queda obert mentre el ratolí o el focus hi són, perquè ningú perdi el
 * «Desfer» mentre hi està arribant.
 */
export function UndoToaster() {
  const t = useUndoToast();
  const [phase, setPhase] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    setPhase("idle");
    setError(null);
  }, [t?.id]);

  useEffect(() => {
    if (!t || hold || phase === "busy" || phase === "error") return;
    const ms = phase === "done" ? 2500 : SECONDS * 1000;
    const timer = setTimeout(() => clearUndo(t.id), ms);
    return () => clearTimeout(timer);
  }, [t, hold, phase]);

  if (!t) return null;

  const undo = async () => {
    setPhase("busy");
    const err = await t.undo().catch(() => "No s'ha pogut desfer.");
    if (err) {
      setError(err);
      setPhase("error");
    } else setPhase("done");
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] print:hidden"
    >
      <div
        role="status"
        aria-live="polite"
        data-undo-toast
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-brand-dark px-4 py-2 text-sm text-white shadow-xl"
      >
        <span className="flex-1">
          {phase === "done" ? "Recuperat." : phase === "error" ? error : t.message}
        </span>
        {(phase === "idle" || phase === "busy") && (
          <button
            type="button"
            onClick={undo}
            disabled={phase === "busy"}
            className={`min-h-11 rounded-lg px-3 font-bold text-white underline-offset-2 hover:underline disabled:opacity-60 ${TAP}`}
          >
            {phase === "busy" ? "Desfent…" : "Desfer"}
          </button>
        )}
        <button
          type="button"
          onClick={() => clearUndo(t.id)}
          aria-label="Tancar l'avís"
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/70 hover:text-white ${TAP}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
