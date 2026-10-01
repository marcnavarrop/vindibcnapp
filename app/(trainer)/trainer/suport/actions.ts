"use server";

import { requireRole } from "@/lib/auth";
import {
  createTicketCore,
  type SupportFormState,
} from "@/lib/data/support-actions-core";

export type { SupportFormState };

export async function createTicketTrainerAction(
  _prev: SupportFormState,
  fd: FormData,
): Promise<SupportFormState> {
  if (!(await requireRole("trainer"))) return { error: "No autoritzat." };
  return createTicketCore(fd, {
    area: "Professional",
    revalidate: "/trainer/suport",
  });
}
