"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TAP } from "@/lib/utils";

/**
 * Peces de les llistes que es filtren i es pagines AL SERVIDOR.
 *
 * La cerca va a l'adreça (`?q=`): el servidor torna a pintar la primera pàgina
 * ja filtrada, i «Carregar més» continua des d'allà amb el cursor. Així un
 * filtre no depèn de quantes files hagin arribat al navegador.
 */

/**
 * El camp de cerca: escriu `?q=` a l'adreça un moment després de parar
 * d'escriure (i treu la pàgina, que torna a començar). `pending` és cert
 * mentre el servidor prepara la llista nova.
 */
export function useUrlQuery(param = "q", delay = 300) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const v = value.trim();
      if (v) next.set(param, v);
      else next.delete(param);
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, delay);
    return () => clearTimeout(t);
    // Només quan canvia el que s'escriu: `params` canvia per culpa nostra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return { value, setValue, pending };
}

/**
 * Carrega pàgines de més a partir d'un cursor. `initial` és la primera pàgina
 * que ha pintat el servidor; el component que la fa servir ha de dur una `key`
 * amb els filtres, perquè en canviar-los es torni a començar.
 */
export function useLoadMore<T extends { id: string }>(
  initial: T[],
  initialCursor: string | null,
  load: (cursor: string) => Promise<{ ok: true; items: T[]; nextCursor: string | null } | { ok: false; error: string }>,
) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      const res = await load(cursor);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...res.items.filter((x) => !seen.has(x.id))];
      });
      setCursor(res.nextCursor);
    });
  };

  return { items, hasMore: cursor !== null, loadMore, pending, error };
}

/** El peu: «N de M» i «Carregar més». */
export function LoadMoreFooter({
  shown,
  total,
  noun,
  hasMore,
  pending,
  error,
  onLoadMore,
}: {
  shown: number;
  total: number | null;
  noun: string;
  hasMore: boolean;
  pending: boolean;
  error: string | null;
  onLoadMore: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {total !== null && (
        <span className="text-brand-muted tabular-nums" data-testid="list-shown">
          {shown} de {total} {noun}
        </span>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={pending}
          className={`min-h-11 rounded-lg border border-brand-border bg-white px-4 font-bold text-brand-purple hover:bg-brand-bg active:bg-brand-bg disabled:opacity-60 ${TAP}`}
        >
          {pending ? "Carregant…" : "Carregar més"}
        </button>
      )}
      {error && (
        <p role="alert" className="w-full text-error">
          {error}
        </p>
      )}
    </div>
  );
}
