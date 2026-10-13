import { clsx } from "@/lib/utils";
import { RequiredMark } from "@/components/ui/required-mark";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Etiqueta en tipus frase, com al login, en lloc de la de majúscules. */
  plainLabel?: boolean;
};

/**
 * Les dues etiquetes dels camps. La de majúscules és la de tota l'app; la
 * «plana» és la del login i les contrasenyes, i la fa servir el registre
 * perquè no barregi els dos estils al mateix formulari.
 */
export function fieldLabelClass(plain?: boolean) {
  return plain
    ? "font-medium text-brand-charcoal"
    : "font-bold tracking-wide text-brand-charcoal uppercase";
}

/**
 * Campo de formulario con etiqueta, estilado con la identidad VindiBCN.
 */
export function Field({ label, plainLabel, className, id, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5 text-sm">
      <span className={fieldLabelClass(plainLabel)}>
        {label}
        {props.required && <RequiredMark />}
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
