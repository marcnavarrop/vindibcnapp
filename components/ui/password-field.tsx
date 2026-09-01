"use client";

import { useId, useState } from "react";
import { clsx } from "@/lib/utils";
import { RequiredMark } from "@/components/ui/required-mark";

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="21" x2="21" y2="3" />}
    </svg>
  );
}

/**
 * Camp de contrasenya amb botó de mostrar/ocultar.
 *
 * L'input segueix sent NO CONTROLAT: el botó només canvia l'atribut `type`,
 * mai el valor. És important que continuï així perquè el login llegeix el
 * valor del FormData en enviar-se, justament per no dependre que l'autocompletat
 * d'iOS dispari cap onChange.
 *
 * El botó és `tabIndex={-1}`: qui va amb teclat vol saltar del camp al submit,
 * no passar per un canvi de visibilitat.
 */
export function PasswordField({
  label,
  className,
  icon,
  showLabel,
  hideLabel,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Icona decorativa a l'esquerra (opcional). */
  icon?: React.ReactNode;
  /**
   * Etiquetes del botó d'ull per a qui fa servir un lector de pantalla.
   * Opcionals i amb el català per defecte: aquest camp també surt a l'àrea
   * d'admin i de professional, que no es tradueixen. Una etiqueta que no es
   * veu també s'ha de poder llegir en l'idioma de qui hi és.
   */
  showLabel?: string;
  hideLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const auto = useId();
  const inputId = props.id ?? props.name ?? auto;

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={inputId} className="font-medium text-brand-charcoal">
        {label}
        {props.required && <RequiredMark />}
      </label>
      <div className="relative">
        {icon && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand-muted"
          >
            {icon}
          </span>
        )}
        <input
          {...props}
          id={inputId}
          type={visible ? "text" : "password"}
          className={clsx(
            "w-full rounded-xl border border-brand-border bg-white py-2.5 text-brand-charcoal",
            "outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20",
            icon ? "pl-10" : "pl-3",
            "pr-11",
            className,
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible
              ? (hideLabel ?? "Amagar la contrasenya")
              : (showLabel ?? "Mostrar la contrasenya")
          }
          aria-pressed={visible}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-brand-muted transition-colors hover:text-brand-purple"
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    </div>
  );
}
