// `createAdminClient`, substituït pel Supabase de memòria (paid:check).
import { fakeClient } from "./fake-supabase";
export function createAdminClient() {
  return fakeClient("admin") as never;
}
