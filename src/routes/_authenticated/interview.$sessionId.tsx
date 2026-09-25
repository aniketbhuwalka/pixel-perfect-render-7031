import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, MicOff, PanelRightClose, PanelRightOpen, RotateCcw, SkipForward } from "lucide-react";
import { api } from "@/lib/api";
import { useInterviewSession } from "@/hooks/useInterviewSession";

export const Route = createFileRoute("/_authenticated/interview/$sessionId")({
  head: () => ({
    meta: [
      { title: "Interview room — PrepPilot" },
      { name: "description", content: "Your live spoken practice interview with the AI interviewer." },
      { property: "og:title", content: "Interview room — PrepPilot" },
      { property: "og:description", content: "A quiet room, one interviewer, five questions." },
    ],
  }),
  component: InterviewRoom,
});

function InterviewRoom() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const [ending, setEnding] = useState(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.getSession(sessionId),
  });

  const interview = useInterviewSession(data?.questions ?? []);
  const started = useRef(false);

  useEffect(() => {
    if (data?.questions?.length && !started.current) {
      started.current = true;
      interview.start();
    }
  }, [data, interview]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [interview.transcript.length]);

  async function finish() {
    interview.end();
    setEnding(true);
    try {
      await api.generateReport(sessionId);
    } finally {
      navigate({ to: "/report/$sessionId", params: { sessionId } });
    }
  }

  const statusLabel =
    interview.status === "connecting"
      ? "Connecting audio…"
      : interview.isInterviewerSpeaking
        ? "Interviewer is speaking"
        : interview.isCandidateSpeaking
          ? "Listening…"
          : interview.status === "thinking"
            ? "Thinking…"
            : interview.status === "ended"
              ? "Interview complete"
              : "Getting ready…";

  return (
    <div className="dark">
      <div className="flex min-h-[calc(100vh-4rem)] bg-background text-foreground">
        <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-14">
          {isLoading || ending ? (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {ending ? "Generating your report…" : "Preparing your interviewer…"}
            </div>
          ) : (
            <>
              <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Question {Math.min(interview.currentQuestionIndex + 1, interview.totalQuestions)} of{" "}
                {interview.totalQuestions}
              </p>

              <div className="relative mt-12 flex size-56 items-center justify-center">
                {interview.isCandidateSpeaking ? (
                  <>
                    <span className="absolute size-56 rounded-full border-2 border-primary/60 animate-listen-ring" />
                    <span
                      className="absolute size-56 rounded-full border-2 border-primary/40 animate-listen-ring"
                      style={{ animationDelay: "0.7s" }}
                    />
                  </>
                ) : null}
                <div
                  className={`size-40 rounded-full bg-gradient-to-br from-primary/90 to-primary/40 shadow-glow ${
                    interview.isInterviewerSpeaking ? "animate-orb-speak" : "animate-orb-breathe"
                  }`}
                />
              </div>

              <div className="mt-12 flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    interview.isCandidateSpeaking
                      ? "bg-success"
                      : interview.isInterviewerSpeaking
                        ? "bg-primary"
                        : "bg-muted-foreground"
                  }`}
                />
                <p className="text-sm font-medium">{statusLabel}</p>
              </div>

              <p className="mt-6 max-w-2xl text-balance text-center text-2xl leading-snug font-medium sm:text-3xl">
                {interview.captions || "…"}
              </p>

              <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
                <Button variant="secondary" onClick={() => setMuted((m) => !m)}>
                  {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  {muted ? "Unmute" : "Mute"}
                </Button>
                <Button variant="secondary" onClick={interview.repeat}>
                  <RotateCcw className="size-4" /> Repeat question
                </Button>
                <Button variant="secondary" onClick={interview.skip}>
                  <SkipForward className="size-4" /> Skip question
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">End interview</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>End this interview?</AlertDialogTitle>
                      <AlertDialogDescription>
                        We'll score what you've answered so far and take you to your report. You
                        can't come back to this room afterwards.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep going</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void finish()}>
                        End and get my report
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {interview.status === "ended" ? (
                <Button className="mt-8" size="lg" onClick={() => void finish()}>
                  See my report
                </Button>
              ) : null}
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4"
            aria-label={panelOpen ? "Hide transcript" : "Show transcript"}
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </Button>
        </main>

        {panelOpen ? (
          <aside className="hidden w-96 shrink-0 border-l border-border bg-card/60 lg:block">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Live transcript</h2>
              <p className="text-xs text-muted-foreground">
                {data?.session.role_title ?? "Interview"}
              </p>
            </div>
            <div className="max-h-[calc(100vh-9rem)] space-y-4 overflow-y-auto px-5 py-5">
              {interview.transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  The conversation will appear here as you speak.
                </p>
              ) : (
                interview.transcript.map((turn) => (
                  <div
                    key={turn.id}
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      turn.speaker === "interviewer"
                        ? "border-primary/25 bg-primary/10"
                        : "border-border bg-background/60"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-medium uppercase tracking-wide">
                        {turn.speaker === "interviewer" ? "Interviewer" : "You"}
                        {turn.isFollowup ? " · follow-up" : ""}
                      </span>
                      <span>{turn.timestamp}</span>
                    </div>
                    <p className="leading-relaxed">{turn.text}</p>
                  </div>
                ))
              )}
              <div ref={transcriptEnd} />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
