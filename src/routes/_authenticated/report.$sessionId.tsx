import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
      { property: "og:description", content: "Scores, gaps and model answers from your interview." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.getSession(sessionId),
  });

  const { data: generated, isLoading: generating } = useQuery({
    queryKey: ["report", sessionId],
    queryFn: () => api.generateReport(sessionId),
    enabled: !!data && !data.report,
  });

  const report = data?.report ?? generated ?? null;

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

      {isLoading || generating || !report || !data ? (
        <div className="space-y-6">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Generating your report…
          </p>
          <Skeleton className="h-52 w-full rounded-xl" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <SessionReportView session={data.session} report={report} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/interview/$sessionId", params: { sessionId } })}
            >
              Practise these questions again
            </Button>
            <Button onClick={() => navigate({ to: "/new" })}>New interview</Button>
          </div>
        </>
      )}
    </main>
  );
}
