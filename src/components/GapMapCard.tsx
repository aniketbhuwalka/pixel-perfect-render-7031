import type { GapMap, GapStatus } from "@/lib/api";

const STATUS: Record<GapStatus, { label: string; dot: string; chip: string }> = {
  strong: {
    label: "Strong",
    dot: "bg-success",
    chip: "border-success/40 bg-success/10 text-success",
  },
  partial: {
    label: "Partial",
    dot: "bg-warning",
    chip: "border-warning/40 bg-warning/10 text-warning",
  },
  missing: {
    label: "Missing",
    dot: "bg-destructive",
    chip: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

/** The resume-vs-JD gap analysis produced when the session was created. */
export function GapMapCard({
  gapMap,
  title = "How your resume maps to this job",
  description,
}: {
  gapMap: GapMap;
  title?: string;
  description?: string;
}) {
  if (!gapMap.length) return null;
  const counts = gapMap.reduce<Record<GapStatus, number>>(
    (acc, g) => ({ ...acc, [g.status]: acc[g.status] + 1 }),
    { strong: 0, partial: 0, missing: 0 },
  );

  return (
    <section className="surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex gap-2 text-xs">
          {(Object.keys(STATUS) as GapStatus[]).map((s) =>
            counts[s] ? (
              <span
                key={s}
                className={`rounded-full border px-2.5 py-1 font-medium ${STATUS[s].chip}`}
              >
                {counts[s]} {STATUS[s].label.toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <ul className="mt-5 divide-y divide-border">
        {gapMap.map((g) => (
          <li key={g.requirement} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS[g.status].dot}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{g.requirement}</p>
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {STATUS[g.status].label}
                </span>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{g.evidence}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
