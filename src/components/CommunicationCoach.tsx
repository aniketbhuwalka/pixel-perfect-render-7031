import { MessageCircle, Target } from "lucide-react";
import type { ApiReport } from "@/lib/api";
import { communicationCoach, focusArea } from "@/lib/communicationCoach";

const tone = (score: number) =>
  score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";

/** How the candidate sounded — clarity, confidence, articulation — from the measured stats. */
export function CommunicationCoach({ report }: { report: ApiReport }) {
  const dimensions = communicationCoach(report);
  const focus = focusArea(dimensions);
  const c = report.communication;

  return (
    <section className="surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <MessageCircle className="size-4 text-primary" /> Communication coach
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            How you came across — measured from your answers, not guessed.
          </p>
        </div>
        {focus ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent/40 px-3 py-1 text-xs font-medium">
            <Target className="size-3.5 text-primary" /> Focus first: {focus.label}
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {dimensions.map((d) => (
          <div
            key={d.key}
            className={`rounded-xl border p-4 ${
              focus?.key === d.key ? "border-primary/40 bg-accent/30" : "border-border"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">{d.label}</p>
              <p className="font-display text-xl font-semibold tabular-nums">
                {d.score ?? "—"}
                {d.score != null ? (
                  <span className="text-xs text-muted-foreground">/100</span>
                ) : null}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              {d.score != null ? (
                <div
                  className={`h-full rounded-full ${tone(d.score)}`}
                  style={{ width: `${d.score}%` }}
                />
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{d.basis}</p>
            <p className="mt-3 text-sm leading-relaxed">{d.observation}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Try: </span>
              {d.tip}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted/60 px-2.5 py-1">
          Filler words: {c.filler_word_count}
        </span>
        <span className="rounded-full bg-muted/60 px-2.5 py-1">
          Pace: {c.pace_wpm != null ? `${c.pace_wpm} wpm` : "—"}
        </span>
        <span className="rounded-full bg-muted/60 px-2.5 py-1">
          Words per answer: {c.avg_words_per_answer}
        </span>
        <span className="rounded-full bg-muted/60 px-2.5 py-1">
          STAR structure:{" "}
          {c.used_star_structure == null ? "—" : c.used_star_structure ? "Yes" : "Not yet"}
        </span>
      </div>
    </section>
  );
}
