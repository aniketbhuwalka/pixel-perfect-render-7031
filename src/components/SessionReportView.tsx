import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CommunicationCoach } from "@/components/CommunicationCoach";
import { GapMapCard } from "@/components/GapMapCard";
import { ResumeReadinessCard } from "@/components/ResumeReadinessCard";
import { ScoreRing } from "@/components/ScoreRing";
import type { ApiReport, ApiSession } from "@/lib/api";
import { Check, Info, TrendingDown, TrendingUp, X } from "lucide-react";

function BulletCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const Icon = tone === "positive" ? Check : X;
  return (
    <div className="surface p-6">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${tone === "positive" ? "text-success" : "text-destructive"}`}
            />
            <span className="leading-relaxed text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TraitCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: { heading: string; body: string; bodyLabel: string }[];
  tone: "positive" | "negative";
}) {
  const Icon = tone === "positive" ? TrendingUp : TrendingDown;
  return (
    <div className="surface p-6">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold">
        <Icon className={`size-4 ${tone === "positive" ? "text-success" : "text-warning"}`} />
        {title}
      </h3>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.heading}>
            <p className="text-sm font-medium">{item.heading}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              <span className="text-xs font-medium tracking-wide uppercase">
                {item.bodyLabel}:{" "}
              </span>
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const scoreTone = (score: number) =>
  score >= 7
    ? "bg-success/15 text-success"
    : score >= 4
      ? "bg-warning/15 text-warning"
      : "bg-destructive/15 text-destructive";

export function SessionReportView({ session, report }: { session: ApiSession; report: ApiReport }) {
  return (
    <div className="space-y-6">
      <section className="surface flex flex-col items-center gap-8 p-8 sm:flex-row sm:items-center">
        <ScoreRing score={report.overall_score} />
        <div className="text-center sm:text-left">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {session.role_title}
          </p>
          <h2 className="mt-3 text-balance text-2xl font-semibold leading-snug">
            {report.verdict_line}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {session.mode === "voice" ? "Spoken interview" : "Text interview"}
            {session.duration_seconds
              ? ` · ${Math.max(1, Math.round(session.duration_seconds / 60))} minutes`
              : ""}
            {` · ${report.per_question.length} questions`}
          </p>
        </div>
      </section>

      {report.reduced ? (
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="leading-relaxed">
            We couldn't write the full debrief for this interview, so you're seeing estimated scores
            only. Your answers are saved below.
          </p>
        </div>
      ) : null}

      {report.what_worked.length || report.what_didnt_work.length ? (
        <div className="grid gap-6 md:grid-cols-2">
          <BulletCard title="What worked" items={report.what_worked} tone="positive" />
          <BulletCard title="What didn't work" items={report.what_didnt_work} tone="negative" />
        </div>
      ) : null}

      {report.strengths.length || report.weaknesses.length ? (
        <div className="grid gap-6 md:grid-cols-2">
          <TraitCard
            title="Your strengths"
            tone="positive"
            items={report.strengths.map((s) => ({
              heading: s.trait,
              body: s.evidence,
              bodyLabel: "Evidence",
            }))}
          />
          <TraitCard
            title="Patterns to fix"
            tone="negative"
            items={report.weaknesses.map((w) => ({
              heading: w.pattern,
              body: w.fix,
              bodyLabel: "Fix",
            }))}
          />
        </div>
      ) : null}

      <CommunicationCoach report={report} />

      {report.jd_fit_summary ? (
        <section className="surface p-6">
          <h3 className="font-display text-base font-semibold">Fit against this job description</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {report.jd_fit_summary}
          </p>
        </section>
      ) : null}

      <GapMapCard gapMap={session.gap_map} title="Requirement by requirement" />

      {session.resume_readiness ? (
        <ResumeReadinessCard readiness={session.resume_readiness} />
      ) : null}

      <section className="surface p-6">
        <h3 className="font-display text-base font-semibold">Question by question</h3>
        <Accordion type="single" collapsible className="mt-2">
          {report.per_question.map((q, i) => (
            <AccordionItem key={q.question_id} value={q.question_id}>
              <AccordionTrigger className="text-left">
                <span className="flex w-full items-center gap-4 pr-3">
                  <span className="text-sm font-medium">
                    {i + 1}. {q.question}
                  </span>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${scoreTone(q.score)}`}
                  >
                    {q.score}/10
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Your answer
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {q.answer_text || (
                      <span className="text-muted-foreground italic">No answer recorded.</span>
                    )}
                  </p>
                </div>
                {q.what_was_missing.length ? (
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      What was missing
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                      {q.what_was_missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {q.model_answer ? (
                  <div className="rounded-xl border border-primary/25 bg-accent/40 p-4">
                    <p className="text-xs font-medium tracking-wide text-primary uppercase">
                      Model answer — built only from your resume
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">{q.model_answer}</p>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {report.top_3_actions.length ? (
        <section className="surface border-primary/30 bg-accent/30 p-6">
          <h3 className="font-display text-base font-semibold">
            Top 3 things to fix before your real interview
          </h3>
          <ol className="mt-4 space-y-3 text-sm">
            {report.top_3_actions.map((action, i) => (
              <li key={action} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{action}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
