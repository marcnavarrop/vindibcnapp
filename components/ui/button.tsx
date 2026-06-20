import { clsx } from "@/lib/utils";

type Variant = "primary" | "accent" | "outline";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-purple text-white hover:bg-brand-purple-light disabled:opacity-50",
  accent:
    "bg-brand-orange text-white hover:opacity-90 disabled:opacity-50",
  outline:
    "border border-brand-border bg-white text-brand-charcoal hover:bg-brand-bg",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-bold tracking-wide uppercase transition-colors",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
