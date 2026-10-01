// `createClient` de la sessió, substituït pel Supabase de memòria (paid:check).
import { fakeClient } from "./fake-supabase";
export async function createClient() {
  return fakeClient() as never;
}
