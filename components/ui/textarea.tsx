import { clsx } from "@/lib/utils";

type TextAreaFieldProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

/** Área de texto con etiqueta, estilada con la identidad VindiBCN. */
export function TextAreaField({
  label,
  className,
  id,
  name,
  ...props
}: TextAreaFieldProps) {
  const areaId = id ?? name;
  return (
    <label htmlFor={areaId} className="flex flex-col gap-1.5 text-sm">
      <span className="font-bold tracking-wide text-brand-charcoal uppercase">
        {label}
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
