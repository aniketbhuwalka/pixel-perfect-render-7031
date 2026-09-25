import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ClipboardPaste, Mic, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PrepPilot — practise interviews out loud" },
      {
        name: "description",
        content:
          "Upload your resume, paste the job description, and sit a real spoken interview with an AI interviewer. Get a scored report at the end.",
      },
      { property: "og:title", content: "PrepPilot — practise interviews out loud" },
      {
        property: "og:description",
        content:
          "A quiet interview room with an AI interviewer that speaks, listens and follows up — then scores you.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: FileText,
    title: "Upload your resume",
    body: "We read it once and use it to ask questions that are actually about you.",
  },
  {
    icon: ClipboardPaste,
    title: "Paste the job description",
    body: "PrepPilot finds the gaps between what they want and what you've shown.",
  },
  {
    icon: Mic,
    title: "Sit a real spoken interview",
    body: "The interviewer asks out loud, listens to your answer, and follows up.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mic className="size-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">PrepPilot</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-5 pt-16 pb-20 text-center sm:pt-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Voice-first interview practice
          </p>
          <h1 className="text-balance text-4xl leading-[1.08] font-semibold sm:text-6xl">
            <span className="text-gradient-accent">Practise the interview,</span>
            <br />
            not the answers on paper.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            PrepPilot reads your resume and the job description, then puts you in a quiet room with
            an interviewer who speaks, listens, and pushes back — and scores you honestly at the end.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/auth">
                Start my interview <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/auth">See a sample report</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="surface p-7">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <step.icon className="size-5" />
                  </span>
                  <span className="font-display text-sm text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card/50">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-semibold">A report you can act on</h2>
              <p className="mt-4 text-muted-foreground">
                One overall score, what worked and what didn't, per-question marks with model
                answers, and the three things to fix before the real thing.
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                "Overall score out of 100 with a one-line verdict",
                "Clarity, structure, filler words and speaking pace",
                "Fit against the exact job description you pasted",
                "Model answer for every question you were asked",
              ].map((item) => (
                <li key={item} className="surface px-5 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        PrepPilot — spoken interview practice
      </footer>
    </div>
  );
}
