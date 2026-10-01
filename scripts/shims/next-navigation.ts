// Stub de "next/navigation" per a `roles:check`: `redirect` acaba l'acció com a Next.
export class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`redirect ${url}`);
  }
}
export function redirect(url: string): never {
  throw new RedirectSignal(url);
}
export function notFound(): never {
  throw new Error("notFound");
}
