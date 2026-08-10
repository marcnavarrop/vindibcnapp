"use server";

import {
  createTicketCore,
  type SupportFormState,
} from "@/lib/data/support-actions-core";

export type { SupportFormState };

export async function createTicketTrainerAction(
  _prev: SupportFormState,
  fd: FormData,
): Promise<SupportFormState> {
  return createTicketCore(fd, {
    area: "Professional",
    revalidate: "/trainer/suport",
  });
}
