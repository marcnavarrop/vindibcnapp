"use server";

import { requireRole } from "@/lib/auth";
import {
  createTicketCore,
  setStatusCore,
  type SupportFormState,
} from "@/lib/data/support-actions-core";

export type { SupportFormState };

export async function createTicketAdminAction(
  _prev: SupportFormState,
  fd: FormData,
): Promise<SupportFormState> {
  if (!(await requireRole("admin"))) return { error: "No autoritzat." };
  return createTicketCore(fd, {
    area: "Administració",
    revalidate: "/admin/suport",
  });
}

export async function setTicketStatusAction(
  _prev: SupportFormState,
  fd: FormData,
): Promise<SupportFormState> {
  if (!(await requireRole("admin"))) return { error: "No autoritzat." };
  return setStatusCore(fd, "/admin/suport");
}
