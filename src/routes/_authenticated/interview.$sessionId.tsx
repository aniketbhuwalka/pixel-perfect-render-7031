import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Headphones,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  SkipForward,
} from "lucide-react";
import { INTERVIEWER_NAME, InterviewerAvatar } from "@/components/InterviewerAvatar";
import { api, type InterviewMode } from "@/lib/api";

const idleLevel = () => 0;
import { useInterviewSession, type UseInterviewSession } from "@/hooks/useInterviewSession";

type Search = { mode?: InterviewMode };

export const Route = createFileRoute("/_authenticated/interview/$sessionId")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const mode = search["mode"];
    return mode === "text" || mode === "voice" ? { mode } : {};
  },
  head: () => ({
    meta: [
      { title: "Interview room — PrepPilot" },
      {
        name: "description",
        content: "Your live spoken practice interview with the AI interviewer.",
      },
      { property: "og:title", content: "Interview room — PrepPilot" },
      { property: "og:description", content: "A quiet room, one interviewer, five questions." },
    ],
  }),
  component: InterviewRoom,
});

function InterviewRoom() {
  const { sessionId } = Route.useParams();
  const search = Route.useSearch();
  const { data, isLoading, error } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.getSession(sessionId),
  });

  if (isLoading)
    return (
      <DarkShell>
        <Centered>
          <Loader2 className="size-5 animate-spin" /> Preparing your interviewer…
        </Centered>
      </DarkShell>
    );
  if (error || !data) {
    return (
      <DarkShell>
        <Centered>
          <p>We couldn't load this interview.</p>
          <Button asChild variant="secondary">
            <Link to="/history">Back to your interviews</Link>
          </Button>
        </Centered>
      </DarkShell>
    );
  }
  if (data.session.status !== "in_progress") {
    return (
      <DarkShell>
        <Centered>
          <p className="text-lg font-medium text-foreground">
            This interview has already finished.
          </p>
          <Button asChild>
            <Link to="/report/$sessionId" params={{ sessionId }}>
              See the report
            </Link>
          </Button>
        </Centered>
      </DarkShell>
    );
  }

  const mode = search.mode ?? data.session.mode;
  // Keyed by mode so switching voice → text starts a fresh connection.
  return (
    <Room
      key={mode}
      sessionId={sessionId}
      mode={mode}
      roleTitle={data.session.role_title}
      questions={data.questions}
    />
  );
}

function DarkShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark">
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-background text-foreground lg:flex-row">
        {children}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  );
}

function Room({
  sessionId,
  mode,
  roleTitle,
  questions,
}: {
  sessionId: string;
  mode: InterviewMode;
  roleTitle: string;
  questions: Parameters<typeof useInterviewSession>[0]["questions"];
}) {
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const interview = useInterviewSession({ sessionId, questions, mode });

  // Follow the conversation, including text that's still streaming in.
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [interview.transcript.length, interview.captions, interview.candidateCaption]);

  async function finish() {
    setEnding(true);
    await interview.end(); // waits for the last answer's transcript and all turn saves
    navigate({ to: "/report/$sessionId", params: { sessionId } });
  }

  const switchToText = () =>
    navigate({ to: "/interview/$sessionId", params: { sessionId }, search: { mode: "text" } });

  const live = !["idle", "error"].includes(interview.status) && !ending;
  // A sliver during the greeting, then halfway through each question as it's asked.
  const progress = interview.totalQuestions
    ? interview.currentQuestionIndex < 0
      ? 3
      : ((interview.currentQuestionIndex + (interview.status === "ended" ? 1 : 0.5)) /
          interview.totalQuestions) *
        100
    : 0;

  return (
    <DarkShell>
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-14">
        {live ? (
          <div className="absolute inset-x-0 top-0 h-1 bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-700"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        ) : null}

        {ending ? (
          <Centered>
            <Loader2 className="size-5 animate-spin" />
            Saving your answers…
          </Centered>
        ) : interview.status === "idle" ? (
          <ReadyCard
            mode={mode}
            roleTitle={roleTitle}
            count={interview.totalQuestions}
            onStart={interview.start}
          />
        ) : interview.status === "error" && interview.error ? (
          <ErrorCard
            interview={interview}
            mode={mode}
            onRetry={interview.start}
            onTextMode={switchToText}
            onFinish={() => void finish()}
          />
        ) : (
          <LiveStage interview={interview} onFinish={() => void finish()} />
        )}
      </main>

      {/* The transcript lives only here: beside the room on wide screens, below it on narrow ones. */}
      <aside className="flex max-h-[50vh] w-full shrink-0 flex-col border-t border-border bg-card/60 lg:max-h-none lg:w-96 lg:border-t-0 lg:border-l">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Live transcript</h2>
          <p className="text-xs text-muted-foreground">{roleTitle}</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 lg:max-h-[calc(100vh-9rem)]">
          {interview.transcript.length === 0 &&
          !interview.captions &&
          !interview.candidateCaption ? (
            <p className="text-sm text-muted-foreground">
              The conversation will appear here as you speak.
            </p>
          ) : null}
          {interview.transcript.map((turn) => (
            <TranscriptBubble
              key={turn.id}
              speaker={turn.speaker}
              text={turn.text}
              meta={turn.timestamp}
              isFollowup={turn.isFollowup}
            />
          ))}
          {/* What's being said right now, streaming in before the turn is final. */}
          {interview.captions ? (
            <TranscriptBubble
              speaker="interviewer"
              text={interview.captions}
              meta="speaking…"
              live
            />
          ) : null}
          {interview.candidateCaption ? (
            <TranscriptBubble
              speaker="candidate"
              text={interview.candidateCaption}
              meta="speaking…"
              live
            />
          ) : null}
          <div ref={transcriptEnd} />
        </div>
      </aside>
    </DarkShell>
  );
}

function TranscriptBubble({
  speaker,
  text,
  meta,
  isFollowup = false,
  live = false,
}: {
  speaker: "interviewer" | "candidate";
  text: string;
  meta: string;
  isFollowup?: boolean;
  live?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        speaker === "interviewer"
          ? "border-primary/25 bg-primary/10"
          : "border-border bg-background/60"
      } ${live ? "border-dashed" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium tracking-wide uppercase">
          {speaker === "interviewer" ? INTERVIEWER_NAME : "You"}
          {isFollowup ? " · follow-up" : ""}
        </span>
        <span className={live ? "animate-pulse" : ""}>{meta}</span>
      </div>
      <p className={`leading-relaxed ${live ? "text-muted-foreground" : ""}`}>{text}</p>
    </div>
  );
}

function ReadyCard({
  mode,
  roleTitle,
  count,
  onStart,
}: {
  mode: InterviewMode;
  roleTitle: string;
  count: number;
  onStart: () => void;
}) {
  return (
    <div className="flex max-w-md flex-col items-center text-center">
      <InterviewerAvatar
        className="size-40"
        getSpeakingLevel={idleLevel}
        getListeningLevel={idleLevel}
        speaking={false}
        listening={false}
      />
      <p className="mt-8 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {roleTitle}
      </p>
      <h1 className="mt-3 text-3xl font-semibold">{INTERVIEWER_NAME} is ready when you are</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {INTERVIEWER_NAME} will say hello first, then ask {count} questions, each with one
        follow-up. No feedback as you go — that all comes in your report at the end.
      </p>
      {mode === "voice" ? (
        <p className="mt-5 flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground">
          <Headphones className="size-4" /> Headphones help the interviewer hear only you.
        </p>
      ) : (
        <p className="mt-5 flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground">
          <Keyboard className="size-4" /> Text mode — you'll type your answers.
        </p>
      )}
      <Button size="lg" className="mt-8" onClick={onStart}>
        {mode === "voice" ? <Mic className="size-4" /> : <Keyboard className="size-4" />}
        Start the interview
      </Button>
    </div>
  );
}

const ERROR_COPY: Record<string, string> = {
  realtime_unavailable: "The voice service isn't available right now.",
  rate_limited:
    "You've started a lot of interviews in a short time. Wait a few minutes and try again.",
  connect_timeout: "Connecting to the interviewer took too long.",
  connection_lost: "The connection to the interviewer dropped.",
  mic_denied:
    "Your browser blocked the microphone. Allow it in the address bar, or switch to text mode.",
  session_not_active: "This interview has already finished.",
  network_error: "We can't reach the PrepPilot server.",
};

function ErrorCard({
  interview,
  mode,
  onRetry,
  onTextMode,
  onFinish,
}: {
  interview: UseInterviewSession;
  mode: InterviewMode;
  onRetry: () => void;
  onTextMode: () => void;
  onFinish: () => void;
}) {
  const err = interview.error!;
  const hasAnswers = interview.transcript.some((t) => t.speaker === "candidate");
  return (
    <div className="flex max-w-md flex-col items-center text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-warning/15 text-warning">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold">Something interrupted the interview</h1>
      <p className="mt-3 text-sm text-muted-foreground">{ERROR_COPY[err.code] ?? err.message}</p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        {err.code !== "session_not_active" ? <Button onClick={onRetry}>Try again</Button> : null}
        {mode === "voice" && err.code !== "session_not_active" ? (
          <Button variant="secondary" onClick={onTextMode}>
            <Keyboard className="size-4" /> Continue in text mode
          </Button>
        ) : null}
        {hasAnswers || err.code === "session_not_active" ? (
          <Button variant="outline" onClick={onFinish}>
            {err.code === "session_not_active" ? "See the report" : "End and get my report"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function LiveStage({
  interview,
  onFinish,
}: {
  interview: UseInterviewSession;
  onFinish: () => void;
}) {
  const [draft, setDraft] = useState("");
  const isText = interview.mode === "text";
  const ended = interview.status === "ended";

  const statusLabel =
    interview.status === "connecting"
      ? "Connecting to your interviewer…"
      : interview.isInterviewerSpeaking
        ? `${INTERVIEWER_NAME} is speaking`
        : interview.isCandidateSpeaking
          ? "Listening…"
          : interview.status === "thinking"
            ? "Thinking…"
            : ended
              ? "Interview complete"
              : isText
                ? "Your turn — type your answer"
                : "Your turn — answer out loud";

  const submit = () => {
    if (!draft.trim()) return;
    interview.sendText(draft);
    setDraft("");
  };

  return (
    <>
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {interview.currentQuestionIndex < 0
          ? "Introductions"
          : `Question ${Math.min(interview.currentQuestionIndex + 1, interview.totalQuestions)} of ${interview.totalQuestions}`}
      </p>

      <div className="relative mt-8 flex size-64 items-center justify-center">
        {interview.isCandidateSpeaking ? (
          <>
            <span className="absolute size-64 rounded-full border-2 border-primary/50 animate-listen-ring" />
            <span
              className="absolute size-64 rounded-full border-2 border-primary/30 animate-listen-ring"
              style={{ animationDelay: "0.7s" }}
            />
          </>
        ) : null}
        <InterviewerAvatar
          className="size-60 drop-shadow-[0_0_40px_oklch(0.62_0.1_195/0.35)]"
          getSpeakingLevel={interview.getOutputLevel}
          getListeningLevel={interview.getInputLevel}
          speaking={interview.isInterviewerSpeaking}
          listening={interview.isCandidateSpeaking}
          dimmed={interview.muted}
        />
      </div>
      <p className="mt-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium">
        {INTERVIEWER_NAME} <span className="text-muted-foreground">· Interviewer</span>
      </p>

      <div className="mt-8 flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${
            interview.isCandidateSpeaking
              ? "bg-success"
              : interview.isInterviewerSpeaking
                ? "bg-primary"
                : interview.status === "connecting" || interview.status === "thinking"
                  ? "animate-pulse bg-muted-foreground"
                  : "bg-muted-foreground"
          }`}
        />
        <p className="text-sm font-medium">
          {interview.muted ? "Muted — the interviewer can't hear you" : statusLabel}
        </p>
      </div>

      {isText && !ended ? (
        <div className="mt-8 flex w-full max-w-2xl gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"
            className="min-h-20 resize-none bg-card"
            disabled={interview.status === "connecting"}
          />
          <Button
            size="icon"
            className="h-auto w-12"
            aria-label="Send answer"
            disabled={!draft.trim()}
            onClick={submit}
          >
            <Send className="size-4" />
          </Button>
        </div>
      ) : null}

      {ended ? (
        <Button className="mt-10" size="lg" onClick={onFinish}>
          See my report
        </Button>
      ) : (
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {!isText ? (
            <Button variant="secondary" onClick={interview.toggleMute}>
              {interview.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              {interview.muted ? "Unmute" : "Mute"}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={interview.repeat}
            disabled={interview.status === "connecting"}
          >
            <RotateCcw className="size-4" /> Repeat question
          </Button>
          <Button
            variant="secondary"
            onClick={interview.skip}
            disabled={interview.status === "connecting"}
          >
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
                  We'll score what you've answered so far and take you to your report. You can't
                  come back to this room afterwards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep going</AlertDialogCancel>
                <AlertDialogAction onClick={onFinish}>End and get my report</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </>
  );
}
