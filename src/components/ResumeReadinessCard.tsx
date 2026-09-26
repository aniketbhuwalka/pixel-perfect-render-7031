import { FileText, PenLine, HelpCircle } from "lucide-react";
import type { ResumeReadiness } from "@/lib/api";

const DIMENSIONS: { key: keyof ResumeReadiness["dimensions"]; label: string }[] = [
  { key: "structure", label: "Structure" },
  { key: "clarity", label: "Clarity" },
  { key: "measurable_outcomes", label: "Measurable outcomes" },
  { key: "keyword_alignment", label: "Keyword match with this JD" },
];

const tone = (score: number) =>
  score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";
const textTone = (score: number) =>
  score >= 75 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";

/** A hiring manager's first scan of the resume against this job, with line-by-line fixes. */
export function ResumeReadinessCard({ readiness }: { readiness: ResumeReadiness }) {
  return (
    <section className="surface p-6">
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-border bg-muted/40">
          <span className={`font-display text-3xl font-semibold ${textTone(readiness.score)}`}>
            {readiness.score}
          </span>
          <span className="text-[10px] text-muted-foreground">out of 100</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <FileText className="size-4 text-primary" /> Resume readiness for this job
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {readiness.verdict}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {DIMENSIONS.map(({ key, label }) => {
          const d = readiness.dimensions[key];
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="font-semibold tabular-nums">{d.score}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${tone(d.score)}`}
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{d.note}</p>
            </div>
          );
        })}
      </div>

      {readiness.missing_keywords.length ? (
        <div className="mt-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            In the job description, not on your resume
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {readiness.missing_keywords.map((k) => (
              <span
                key={k}
                className="rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {readiness.fixes.length ? (
        <div className="mt-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Edits to make tonight
          </p>
          <ol className="mt-3 space-y-3">
            {readiness.fixes.map((f, i) => (
              <li
                key={`${f.where}-${i}`}
                className="rounded-xl border border-border bg-muted/20 p-4 text-sm"
              >
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    f.kind === "rewrite"
                      ? "bg-primary/10 text-primary"
                      : "bg-warning/15 text-warning"
                  }`}
                >
                  {f.kind === "rewrite" ? (
                    <PenLine className="size-3" />
                  ) : (
                    <HelpCircle className="size-3" />
                  )}
                  {f.kind === "rewrite" ? "Rewrite" : "Only if it's true"}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">
                  {f.kind === "rewrite" ? "Your line" : "Where"}:{" "}
                  <span className="italic">“{f.where}”</span>
                </p>
                <p className="mt-1.5 leading-relaxed">{f.fix}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Why: {f.why}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Replace any [X] placeholders with your real numbers — never add something you didn't do.
          </p>
        </div>
      ) : null}
    </section>
  );
}
