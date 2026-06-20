import { clsx } from "@/lib/utils";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

/**
 * Campo de formulario con etiqueta, estilado con la identidad VindiBCN.
 */
export function Field({ label, className, id, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5 text-sm">
      <span className="font-bold tracking-wide text-brand-charcoal uppercase">
        {label}
      </span>
      <input
        id={inputId}
        className={clsx(
          "rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-charcoal",
          "outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20",
          className,
        )}
        {...props}
      />
    </label>
  );
}
