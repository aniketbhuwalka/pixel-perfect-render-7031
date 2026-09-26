import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionReportView } from "@/components/SessionReportView";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/report/$sessionId")({
  head: () => ({
    meta: [
      { title: "Session report — PrepPilot" },
      {
        name: "description",
        content: "Your scored interview report: what worked, what didn't, and model answers.",
      },
      { property: "og:title", content: "Session report — PrepPilot" },
      {
        property: "og:description",
        content: "Scores, gaps and model answers from your interview.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [restarting, setRestarting] = useState(false);

  const {
    data,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.getSession(sessionId),
  });

  // Idempotent on the server: returns the stored report, or generates it exactly once.
  const {
    data: generated,
    isLoading: generating,
    error: generateError,
    refetch,
  } = useQuery({
    queryKey: ["report", sessionId],
    queryFn: () => api.generateReport(sessionId),
    enabled: !!data && !data.report,
    retry: false,
    staleTime: Infinity,
  });

  const queryClient = useQueryClient();
  // Generating the report completes the session (status, duration), so reload it afterwards.
  useEffect(() => {
    if (generated) void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
  }, [generated, queryClient, sessionId]);

  const report = data?.report ?? generated ?? null;
  const session = data?.session ?? null;

  async function practiseAgain() {
    if (!data?.session.resume_id) return navigate({ to: "/new" });
    setRestarting(true);
    try {
      const res = await api.createSession({
        resume_id: data.session.resume_id,
        role_title: data.session.role_title,
        jd_text: data.session.jd_text,
        mode: data.session.mode,
      });
      navigate({
        to: data.session.mode === "voice" ? "/preflight/$sessionId" : "/interview/$sessionId",
        params: { sessionId: res.session_id },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start a new interview.");
      setRestarting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Session report</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/history">All sessions</Link>
          </Button>
          <Button onClick={() => navigate({ to: "/new" })}>New interview</Button>
        </div>
      </div>

      {loadError ? (
        <div className="surface p-10 text-center text-sm text-muted-foreground">
          {loadError instanceof Error ? loadError.message : "We couldn't load this session."}
        </div>
      ) : generateError && !report ? (
        <div className="surface flex flex-col items-center p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <AlertTriangle className="size-6" />
          </span>
          <h2 className="mt-5 text-xl font-semibold">We couldn't build your report</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {generateError instanceof Error ? generateError.message : "Something went wrong."} Your
            answers are saved, so trying again won't lose anything.
          </p>
          <Button className="mt-6" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading || generating || !report || !session ? (
        <div className="space-y-6">
          <div className="surface flex items-center gap-4 p-6">
            <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Writing your debrief…</p>
              <p className="text-xs text-muted-foreground">
                Reading the transcript, scoring each answer and drafting model answers. This takes
                about 20 seconds.
              </p>
            </div>
          </div>
          <Skeleton className="h-52 w-full rounded-xl" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <SessionReportView session={session} report={report} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="outline" disabled={restarting} onClick={() => void practiseAgain()}>
              {restarting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              {restarting ? "Preparing new questions…" : "Practise this role again"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/history/$sessionId" params={{ sessionId }}>
                Read the transcript
              </Link>
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
