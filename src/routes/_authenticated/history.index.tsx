import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type SessionSummary } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/history/")({
  head: () => ({
    meta: [
      { title: "Your interviews — PrepPilot" },
      {
        name: "description",
        content: "Every practice interview you've sat, with scores over time.",
      },
      { property: "og:title", content: "Your interviews — PrepPilot" },
      { property: "og:description", content: "Reopen any past session report and see your trend." },
    ],
  }),
  component: History,
});

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtDuration = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "—");

function StatusBadge({ session }: { session: SessionSummary }) {
  if (session.overall_score != null) return null;
  const label =
    session.status === "in_progress"
      ? "Not finished"
      : session.status === "abandoned"
        ? "Abandoned"
        : "No report";
  return (
    <span className="ml-2 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function History() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sessions"],
    queryFn: api.listSessions,
  });
  const sessions = data?.sessions ?? [];
  const spark = [...sessions]
    .filter((s) => s.overall_score != null)
    .reverse()
    .map((s) => ({ score: s.overall_score }));

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Your interviews</h1>
          <p className="mt-2 text-muted-foreground">Reopen any session to replay it.</p>
        </div>
        {spark.length > 1 ? (
          <div className="surface w-52 p-4">
            <p className="text-xs text-muted-foreground">Score over time</p>
            <div className="mt-2 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark}>
                  <YAxis hide domain={[0, 100]} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="surface p-12 text-center">
          <h2 className="text-lg font-semibold">We couldn't load your interviews</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
          <Button className="mt-6" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="surface p-12 text-center">
          <h2 className="text-lg font-semibold">No interviews yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Your first session takes about fifteen minutes. Upload a resume, paste a job
            description, and start talking.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/new">Start my first interview</Link>
          </Button>
        </div>
      ) : (
        <div className="surface overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({ to: "/history/$sessionId", params: { sessionId: s.id } })
                  }
                >
                  <TableCell className="font-medium">
                    {s.role_title}
                    <StatusBadge session={s} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(s.started_at)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{s.mode}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDuration(s.duration_seconds)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {s.overall_score ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
