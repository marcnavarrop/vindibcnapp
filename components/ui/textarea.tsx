import { clsx } from "@/lib/utils";
import { RequiredMark } from "@/components/ui/required-mark";
import { fieldLabelClass } from "@/components/ui/input";

type TextAreaFieldProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  /** Etiqueta en tipus frase (vegeu `fieldLabelClass`). */
  plainLabel?: boolean;
};

/** Área de texto con etiqueta, estilada con la identidad VindiBCN. */
export function TextAreaField({
  label,
  plainLabel,
  className,
  id,
  name,
  ...props
}: TextAreaFieldProps) {
  const areaId = id ?? name;
  return (
    <label htmlFor={areaId} className="flex flex-col gap-1.5 text-sm">
      <span className={fieldLabelClass(plainLabel)}>
        {label}
        {props.required && <RequiredMark />}
      </span>
      <textarea
        id={areaId}
        name={name}
        rows={3}
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
