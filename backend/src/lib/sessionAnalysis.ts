import type { GapMap } from "../services/questionPlan.js";
import type { ResumeReadiness } from "../services/resumeReadiness.js";

/**
 * Everything produced when a session is planned. It's stored in the `sessions.gap_map` jsonb
 * column as `{ requirements, resume_readiness }` so no schema migration is needed; older
 * sessions stored just the requirements array, which unpacks the same way.
 */
export type SessionAnalysis = { requirements: GapMap; resume_readiness: ResumeReadiness | null };

export function unpackAnalysis(raw: unknown): SessionAnalysis {
  if (Array.isArray(raw)) return { requirements: raw as GapMap, resume_readiness: null };
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<SessionAnalysis>;
    return {
      requirements: Array.isArray(obj.requirements) ? obj.requirements : [],
      resume_readiness: obj.resume_readiness ?? null,
    };
  }
  return { requirements: [], resume_readiness: null };
}
