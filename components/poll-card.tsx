"use client";

import { useRef } from "react";
import { submitPollResponseAction } from "@/app/(client)/client/comunitat/actions";
import type { PollForClient } from "@/lib/data/polls";
import { formatDate } from "@/lib/labels";

export function PollCard({ poll }: { poll: PollForClient }) {
  const formRef = useRef<HTMLFormElement>(null);
  const hasVoted = poll.myOptionIds.length > 0;
  const isClosed =
    !poll.active ||
    (poll.closesAt != null &&
      poll.closesAt < new Date().toISOString().slice(0, 10));

  const totalVotes = poll.options.reduce((s, _o) => s, 0); // computed below per option
  // We don't have vote counts on the client view — just show "ja has votat"

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-purple/30 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-purple px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
          Enquesta
        </span>
        {isClosed && (
          <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-muted uppercase">
            Tancada
          </span>
        )}
        <span className="text-xs font-bold tracking-wide text-brand-muted uppercase">
          {formatDate(poll.createdAt)}
          {poll.closesAt && !isClosed && ` · Fins al ${formatDate(poll.closesAt)}`}
        </span>
      </div>

      <h2 className="mt-3 text-lg text-brand-dark">{poll.question}</h2>

      {hasVoted ? (
        <div className="mt-3 flex flex-col gap-2">
          {poll.options.map((opt) => {
            const isMyVote = poll.myOptionIds.includes(opt.id);
            return (
              <div
                key={opt.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isMyVote
                    ? "bg-brand-purple/10 font-bold text-brand-purple"
                    : "text-brand-muted"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    isMyVote ? "border-brand-purple bg-brand-purple" : "border-brand-border"
                  }`}
                >
                  {isMyVote && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
                      <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </div>
            );
          })}
          <p className="mt-1 text-xs text-brand-muted">
            Ja has respost · no es pot canviar el vot.
          </p>
        </div>
      ) : isClosed ? (
        <p className="mt-3 text-sm text-brand-muted">
          Aquesta enquesta ja no accepta respostes.
        </p>
      ) : (
        <form
          ref={formRef}
          action={submitPollResponseAction}
          className="mt-3 flex flex-col gap-2"
        >
          <input type="hidden" name="poll_id" value={poll.id} />
          {poll.options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-brand-border px-3 py-2.5 text-sm text-brand-charcoal transition-colors hover:border-brand-purple hover:bg-brand-purple/5"
            >
              <input
                type={poll.allowMultiple ? "checkbox" : "radio"}
                name="option_id"
                value={opt.id}
                required={!poll.allowMultiple}
                className="h-4 w-4 accent-brand-purple"
              />
              {opt.label}
            </label>
          ))}
          <button
            type="submit"
            className="mt-1 self-start rounded-lg bg-brand-purple px-4 py-2 text-sm font-bold text-white hover:bg-brand-purple-light"
          >
            Enviar resposta
          </button>
        </form>
      )}
    </article>
  );
}
