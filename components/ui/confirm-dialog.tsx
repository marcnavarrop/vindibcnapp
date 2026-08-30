"use client";

import { useEffect, useRef } from "react";

/**
 * Diàleg modal de confirmació.
 *
 * Existeix per als passos que no es poden desfer (generar una factura i
 * enviar-la, per exemple): el contingut és lliure perquè el resum del que
 * passarà es pugui ensenyar sencer abans de decidir.
 *
 * El botó de confirmar el posa qui el fa servir a `actions` — així pot ser el
 * submit d'un formulari amb server action, i no cal que el diàleg sàpiga res
 * del que s'està confirmant.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  ariaClose,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions: React.ReactNode;
  /**
   * Etiqueta del fons clicable per a qui fa servir un lector de pantalla.
   * Opcional i amb el català per defecte: aquest diàleg també surt a l'àrea
   * d'admin, que no es tradueix. Les pantalles de client SÍ que l'han de
   * passar —una etiqueta invisible també s'ha de poder llegir.
   */
  ariaClose?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape tanca, i el fons no ha de poder-se desplaçar mentre és obert.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-brand-dark/50 p-4 sm:items-center">
      {/* Clic al fons = cancel·lar. */}
      <button
        type="button"
        aria-label={ariaClose ?? "Tancar"}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative my-auto w-full max-w-lg rounded-2xl border border-brand-border bg-white p-6 shadow-xl outline-none"
      >
        <h2 className="text-lg font-bold text-brand-dark">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-brand-muted">{description}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {actions}
        </div>
      </div>
    </div>
  );
}
