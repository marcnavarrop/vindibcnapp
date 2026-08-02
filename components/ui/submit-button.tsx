"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Botón de envío para formularios con Server Actions: se deshabilita y muestra
 * un texto de carga mientras la acción está en curso.
 */
export function SubmitButton({
  children,
  pendingLabel = "Desant…",
  variant,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
