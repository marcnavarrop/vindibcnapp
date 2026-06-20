import { clsx } from "@/lib/utils";

type Tone = "success" | "neutral" | "danger" | "info" | "warn";

const TONES: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  neutral: "bg-brand-muted/10 text-brand-muted",
  danger: "bg-error/10 text-error",
  info: "bg-brand-purple/10 text-brand-purple",
  warn: "bg-brand-orange/10 text-brand-orange",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
