"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TAP } from "@/lib/utils";

/**
 * «Més ▾»: les accions que no són la principal, en un menú.
 *
 * Es tanca en tocar fora, amb Escape (i el focus torna al botó) i en triar
 * una opció. Cada opció només obre la confirmació de sempre: el menú no fa
 * res irreversible pel seu compte.
 */
export function MoreMenu({
  items,
  label = "Més",
}: {
  items: { label: string; onSelect: () => void; danger?: boolean }[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={wrap} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-11 items-center gap-1 rounded-lg border border-brand-border bg-white px-3.5 text-sm font-bold whitespace-nowrap text-brand-dark hover:bg-brand-bg ${TAP}`}
      >
        {label}
        <svg aria-hidden="true" viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-[12rem] rounded-xl border border-brand-border bg-white py-1 shadow-lg"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={`flex h-11 w-full items-center px-4 text-left text-sm font-bold hover:bg-brand-bg ${it.danger ? "text-error" : "text-brand-dark"}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
