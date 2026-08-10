"use server";

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
  return createTicketCore(fd, {
    area: "Administració",
    revalidate: "/admin/suport",
  });
}

export async function setTicketStatusAction(
  _prev: SupportFormState,
  fd: FormData,
): Promise<SupportFormState> {
  return setStatusCore(fd, "/admin/suport");
}
