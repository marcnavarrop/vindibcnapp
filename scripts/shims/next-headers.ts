// Stub de "next/headers" per a `roles:check`: la cookie de rol de la simulació
// surt de `globalThis.__mockRole`; sense capçaleres del middleware.
const store = () => ({
  get: (name: string) =>
    name === "vindi_mock_role" && (globalThis as { __mockRole?: string }).__mockRole
      ? { name, value: (globalThis as { __mockRole?: string }).__mockRole }
      : undefined,
  getAll: () => [],
  has: () => false,
  set: () => {},
  delete: () => {},
});
export async function cookies() {
  return store();
}
export async function headers() {
  return new Headers();
}
