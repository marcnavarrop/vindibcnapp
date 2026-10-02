// Un Supabase de memòria per a `paid:check`: prou PostgREST per provar la
// branca REAL d'una funció (no la de la simulació) sense tocar cap base.
//
// `globalThis.__fakeDb` té les taules; `__fakeDb.hooks.beforeUpdate(table,
// rows)` pot canviar les files abans d'una actualització (un cobrament que
// arriba alhora) i `hooks.canUpdate(table, row)` fa de RLS. Si hi ha
// `__fakeDb.writes`, s'hi apunta cada escriptura amb el client que l'ha feta
// («session» o «admin», la clau de servei): així es pot provar quin camí pren.
type Row = Record<string, unknown>;
type Db = {
  tables: Record<string, Row[]>;
  hooks: {
    beforeUpdate?: (table: string, rows: Row[]) => void;
    canUpdate?: (table: string, row: Row) => boolean;
  };
  writes?: { table: string; op: string; via: Via }[];
};
type Via = "session" | "admin";
const db = (): Db => (globalThis as { __fakeDb?: Db }).__fakeDb!;

type Res = { data: unknown; error: unknown; count?: number | null };

class Query implements PromiseLike<Res> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: ((r: Row) => boolean)[] = [];
  private payload: Row | Row[] | null = null;
  private returning = false;
  private one: "single" | "maybe" | null = null;
  private head = false;
  private lim: number | null = null;
  constructor(private table: string, private via: Via) {}
  select(_cols?: string, opts?: { head?: boolean }) {
    if (this.op !== "select") this.returning = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(r[c])); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  gt(c: string, v: string) { this.filters.push((r) => String(r[c]) > v); return this; }
  gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this; }
  lt(c: string, v: string) { this.filters.push((r) => String(r[c]) < v); return this; }
  ilike(c: string, v: string) {
    const re = new RegExp(`^${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`, "i");
    this.filters.push((r) => re.test(String(r[c] ?? "")));
    return this;
  }
  limit(n: number) { this.lim = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  private rows() { return (db().tables[this.table] ??= []); }
  private run() {
    const all = this.rows();
    let data: Row[] = [];
    if (this.op !== "select") db().writes?.push({ table: this.table, op: this.op, via: this.via });
    if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((p) => ({ id: crypto.randomUUID(), ...p }));
      all.push(...items);
      data = items;
    } else if (this.op === "update") {
      db().hooks.beforeUpdate?.(this.table, all);
      data = all.filter((r) => this.filters.every((f) => f(r)) && (db().hooks.canUpdate?.(this.table, r) ?? true));
      for (const r of data) Object.assign(r, this.payload);
    } else if (this.op === "delete") {
      data = all.filter((r) => this.filters.every((f) => f(r)));
      db().tables[this.table] = all.filter((r) => !data.includes(r));
    } else {
      data = all.filter((r) => this.filters.every((f) => f(r)));
    }
    if (this.lim !== null) data = data.slice(0, this.lim);
    const copy = data.map((r) => ({ ...r }));
    if (this.head) return { data: null, error: null, count: copy.length };
    if (this.op !== "select" && !this.returning) return { data: null, error: null };
    if (this.one) {
      if (copy.length === 1) return { data: copy[0], error: null };
      if (this.one === "maybe" && copy.length === 0) return { data: null, error: null };
      return { data: null, error: { message: `JSON object requested, ${copy.length} rows returned`, code: "PGRST116" } };
    }
    return { data: copy, error: null };
  }
  then<A = Res, B = never>(
    ok?: ((v: Res) => A | PromiseLike<A>) | null,
    ko?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run() as Res).then(ok, ko);
  }
}

// Qualsevol mètode que el fals no conegui (order, or, not, gte…) es deixa
// passar sense filtrar: només el fan servir efectes secundaris que aquí no
// es proven.
function wrap(q: Query): Query {
  return new Proxy(q, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      if (v !== undefined || typeof k !== "string") return typeof v === "function" ? v.bind(t) : v;
      return () => r;
    },
  });
}

export function fakeClient(via: Via = "session") {
  return {
    from: (table: string) => wrap(new Query(table, via)),
    rpc: async () => ({ data: null, error: null }),
    // La sessió: `globalThis.__fakeUser` ({ id, email }) o ningú.
    auth: {
      getUser: async () => ({ data: { user: (globalThis as { __fakeUser?: unknown }).__fakeUser ?? null }, error: null }),
    },
  };
}
