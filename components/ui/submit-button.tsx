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
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
