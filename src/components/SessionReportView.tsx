import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScoreRing } from "@/components/ScoreRing";
import type { ApiReport, ApiSession } from "@/lib/api";
import { Check, X, TrendingUp, TrendingDown } from "lucide-react";

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
              className={`mt-0.5 size-4 shrink-0 ${
                tone === "positive" ? "text-success" : "text-destructive"
              }`}
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
  items: string[];
  tone: "positive" | "negative";
}) {
  const Icon = tone === "positive" ? TrendingUp : TrendingDown;
  return (
    <div className="surface p-6">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold">
        <Icon className={`size-4 ${tone === "positive" ? "text-success" : "text-warning"}`} />
        {title}
      </h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SessionReportView({
  session,
  report,
}: {
  session: ApiSession;
  report: ApiReport;
}) {
  const comms = [
    { label: "Clarity", value: `${report.communication.clarity}/100` },
    { label: "Structure", value: `${report.communication.structure}/100` },
    { label: "Filler words", value: `${report.communication.filler_words}` },
    { label: "Speaking pace", value: `${report.communication.pace_wpm} wpm` },
  ];

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
              ? ` · ${Math.round(session.duration_seconds / 60)} minutes`
              : ""}
            {` · ${report.per_question.length} questions`}
          </p>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <BulletCard title="What worked" items={report.what_worked} tone="positive" />
        <BulletCard title="What didn't work" items={report.what_didnt_work} tone="negative" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <TraitCard title="Your strengths" items={report.strengths} tone="positive" />
        <TraitCard title="Your weaknesses" items={report.weaknesses} tone="negative" />
      </div>

      <section className="surface grid grid-cols-2 divide-border p-0 sm:grid-cols-4 sm:divide-x">
        {comms.map((c) => (
          <div key={c.label} className="px-6 py-5">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-xl font-semibold">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="surface p-6">
        <h3 className="font-display text-base font-semibold">Fit against this JD</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {report.jd_fit_summary}
        </p>
      </section>

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
                  <span className="ml-auto shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                    {q.score}/10
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Your answer
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{q.answer_text}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What was missing
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{q.missing}</p>
                </div>
                <div className="rounded-xl border border-primary/25 bg-accent/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    Model answer
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{q.model_answer}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

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
    </div>
  );
}
