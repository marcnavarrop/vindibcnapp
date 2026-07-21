import Link from "next/link";
import { notFound } from "next/navigation";
import { getPollResult } from "@/lib/data/polls";
import { closePollAction } from "@/app/(admin)/admin/community/polls/actions";
import { formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PollResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const poll = await getPollResult(id);
  if (!poll) notFound();

  const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
  const respondents = new Set(
    poll.options.flatMap((o) => o.voters.map((v) => v.clientId)),
  ).size;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/community?tab=polls"
          className="text-sm text-brand-muted hover:text-brand-dark"
        >
          ← Tornar
        </Link>
        <h1 className="text-2xl text-brand-dark">Resultats de l&apos;enquesta</h1>
      </div>

      <div className="rounded-2xl border border-brand-border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              {poll.allowMultiple ? "Selecció múltiple" : "Opció única"} ·{" "}
              {formatDate(poll.createdAt)}
              {poll.closesAt && ` · Tanca ${formatDate(poll.closesAt)}`}
            </p>
            <h2 className="mt-1 text-xl text-brand-dark">{poll.question}</h2>
            <p className="mt-1 text-sm text-brand-muted">
              {respondents} participant{respondents !== 1 ? "s" : ""} ·{" "}
              {totalVotes} vot{totalVotes !== 1 ? "s" : ""}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              poll.active
                ? "bg-green-100 text-green-700"
                : "bg-brand-bg text-brand-muted"
            }`}
          >
            {poll.active ? "Activa" : "Tancada"}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {poll.options.map((opt) => {
            const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
            return (
              <details key={opt.id} className="group">
                <summary className="flex cursor-pointer list-none flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-brand-dark">{opt.label}</span>
                    <span className="text-brand-muted">
                      {opt.voteCount} vot{opt.voteCount !== 1 ? "s" : ""} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-brand-bg">
                    <div
                      className="h-full rounded-full bg-brand-purple transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </summary>
                {opt.voters.length > 0 && (
                  <ul className="mt-2 ml-1 flex flex-wrap gap-2">
                    {opt.voters.map((v) => (
                      <li
                        key={v.clientId}
                        className="rounded-full border border-brand-border bg-brand-bg px-3 py-1 text-xs text-brand-charcoal"
                      >
                        {v.clientName}
                      </li>
                    ))}
                  </ul>
                )}
                {opt.voters.length === 0 && (
                  <p className="mt-2 ml-1 text-xs text-brand-muted">
                    Ningú ha votat aquesta opció.
                  </p>
                )}
              </details>
            );
          })}
        </div>

        {poll.active && (
          <form action={closePollAction} className="mt-6 border-t border-brand-border pt-4">
            <input type="hidden" name="id" value={poll.id} />
            <button
              type="submit"
              className="rounded-lg border border-brand-border px-4 py-2 text-sm font-bold text-brand-muted hover:border-error hover:text-error"
            >
              Tancar enquesta
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
