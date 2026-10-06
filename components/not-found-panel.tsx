import Link from "next/link";
import { SearchX } from "lucide-react";
import { clsx, TAP } from "@/lib/utils";

/**
 * La pàgina «no existeix» de l'app, en comptes de la de Next («404 This page
 * could not be found», en anglès i sense estil).
 *
 * Una sola peça per als quatre llocs on surt: les tres àrees (dins del marc,
 * amb el menú) i la pública de l'arrel. Els textos arriben ja escrits: l'admin
 * i el professional van en català fix, i el client i les pàgines públiques,
 * en el seu idioma.
 */
export function NotFoundPanel({
  title,
  body,
  backHref,
  backLabel,
}: {
  title: string;
  body: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-brand-border bg-white p-6 sm:p-8">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-bg text-brand-purple"
      >
        <SearchX className="h-6 w-6" />
      </span>
      <div>
        <p className="text-xs font-bold tracking-wide text-brand-muted uppercase">404</p>
        <h1 className="mt-1 text-2xl text-brand-dark">{title}</h1>
        <p className="mt-2 max-w-prose text-sm text-brand-muted">{body}</p>
      </div>
      <Link
        href={backHref}
        className={clsx(
          "inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-bold tracking-wide text-white uppercase hover:bg-brand-purple-light active:bg-brand-purple-dark",
          TAP,
        )}
      >
        {backLabel}
      </Link>
    </div>
  );
}
