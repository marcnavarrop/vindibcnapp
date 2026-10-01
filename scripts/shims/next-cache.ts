// Stub de "next/cache" per a `roles:check`: fora de Next no hi ha res a revalidar.
export function revalidatePath() {}
export function revalidateTag() {}
export function unstable_cache<T extends (...a: never[]) => unknown>(fn: T): T {
  return fn;
}
