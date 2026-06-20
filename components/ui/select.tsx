import { clsx } from "@/lib/utils";

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

/** Desplegable con etiqueta, estilado con la identidad VindiBCN. */
export function SelectField({
  label,
  options,
  placeholder,
  className,
  id,
  name,
  ...props
}: SelectFieldProps) {
  const selectId = id ?? name;
  return (
    <label htmlFor={selectId} className="flex flex-col gap-1.5 text-sm">
      <span className="font-bold tracking-wide text-brand-charcoal uppercase">
        {label}
      </span>
      <select
        id={selectId}
        name={name}
        className={clsx(
          "rounded-lg border border-brand-border bg-white px-3 py-2.5 text-brand-charcoal",
          "outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20",
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
