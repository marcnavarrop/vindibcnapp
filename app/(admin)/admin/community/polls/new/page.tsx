"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPollAction } from "@/app/(admin)/admin/community/polls/actions";

export default function NewPollPage() {
  const router = useRouter();
  const [options, setOptions] = useState(["", ""]);

  function addOption() {
    setOptions((o) => [...o, ""]);
  }
  function removeOption(i: number) {
    setOptions((o) => o.filter((_, idx) => idx !== i));
  }
  function updateOption(i: number, val: string) {
    setOptions((o) => o.map((v, idx) => (idx === i ? val : v)));
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-brand-muted hover:text-brand-dark"
        >
          ← Tornar
        </button>
        <h1 className="text-2xl text-brand-dark">Nova enquesta</h1>
      </div>

      <form action={createPollAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-bold text-brand-dark">
            Pregunta <span className="text-error">*</span>
          </label>
          <textarea
            name="question"
            required
            rows={2}
            placeholder="Quina és la teva pregunta?"
            className="rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-bold text-brand-dark">Opcions <span className="text-error">*</span></span>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                name={`option_${i}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Opció ${i + 1}`}
                className="flex-1 rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="text-sm text-brand-muted hover:text-error"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="self-start text-xs font-bold text-brand-purple hover:text-brand-orange"
          >
            + Afegir opció
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-bg p-4">
          <span className="text-sm font-bold text-brand-dark">Configuració</span>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="allow_multiple"
              value="true"
              className="h-4 w-4 rounded accent-brand-purple"
            />
            <span className="text-sm text-brand-charcoal">
              Permetre selecció múltiple
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold tracking-wide text-brand-muted uppercase">
              Data de tancament (opcional)
            </label>
            <input
              type="date"
              name="closes_at"
              className="w-fit rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-charcoal outline-none focus:border-brand-purple"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-purple-light"
          >
            Publicar enquesta
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-brand-border px-5 py-2.5 text-sm font-bold text-brand-muted hover:text-brand-dark"
          >
            Cancel·lar
          </button>
        </div>
      </form>
    </main>
  );
}
