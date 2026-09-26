import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionReportView } from "@/components/SessionReportView";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/history/$sessionId")({
  head: () => ({
    meta: [
      { title: "Past session — PrepPilot" },
      {
        name: "description",
        content: "Read-only replay of a past interview: full transcript and scored report.",
      },
      { property: "og:title", content: "Past session — PrepPilot" },
      { property: "og:description", content: "Replay the transcript and reread the report." },
    ],
  }),
  component: SessionDetail,
});

function SessionDetail() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.getSession(sessionId),
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{data?.session.role_title ?? "Past session"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Read-only replay</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/history">Back to history</Link>
        </Button>
      </div>

      {error ? (
        <div className="surface p-10 text-center text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "We couldn't load this session."}
        </div>
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="font-display text-base font-semibold">Transcript</h2>
            <div className="mt-4 space-y-4">
              {data.turns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing was said in this session yet.
                </p>
              ) : null}
              {data.turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    turn.speaker === "interviewer"
                      ? "border-primary/25 bg-accent/40"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium uppercase tracking-wide">
                      {turn.speaker === "interviewer" ? "Interviewer" : "You"}
                      {turn.is_followup ? " · follow-up" : ""}
                    </span>
                    <span>
                      {new Date(turn.started_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="leading-relaxed">{turn.text}</p>
                </div>
              ))}
            </div>
          </section>

          {data.report ? (
            <SessionReportView session={data.session} report={data.report} />
          ) : (
            <div className="surface flex flex-col items-center gap-4 p-8 text-center text-sm text-muted-foreground">
              {data.session.status === "in_progress" ? (
                <>
                  <p>This interview isn't finished yet.</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      onClick={() =>
                        navigate({
                          to:
                            data.session.mode === "voice"
                              ? "/preflight/$sessionId"
                              : "/interview/$sessionId",
                          params: { sessionId },
                        })
                      }
                    >
                      Continue the interview
                    </Button>
                    {data.turns.some((t) => t.speaker === "candidate") ? (
                      <Button variant="outline" asChild>
                        <Link to="/report/$sessionId" params={{ sessionId }}>
                          End it and get my report
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <p>This session ended before a report was generated.</p>
                  <Button asChild>
                    <Link to="/report/$sessionId" params={{ sessionId }}>
                      Generate the report
                    </Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
