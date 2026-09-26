import { z } from "zod";
import { openai } from "../lib/openai.js";
import { resumeReadinessPrompt, type ResumeReadinessPromptInput } from "../prompts/resumeReadiness.js";

// A stronger model than the question plan's: candidates may paste these fixes into a real
// application, and gpt-4o-mini kept "improving" lines into claims the resume never made.
const MODEL = "gpt-5.4-mini";

const score = z.number().min(0).max(100).transform(Math.round);
const dimension = z.object({ score, note: z.string().trim().min(1) });

export const resumeReadinessSchema = z.object({
  score,
  verdict: z.string().trim().min(1),
  dimensions: z.object({
    structure: dimension,
    clarity: dimension,
    measurable_outcomes: dimension,
    keyword_alignment: dimension,
  }),
  missing_keywords: z.preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, 8) : v),
    z.array(z.string().trim().min(1)),
  ),
  fixes: z.preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, 5) : v),
    z
      .array(
        z.object({
          kind: z.enum(["rewrite", "add_if_true"]),
          where: z.string().trim().min(1),
          fix: z.string().trim().min(1),
          why: z.string().trim().min(1),
          // The model's own honesty check; used to filter, never sent to the client.
          new_claims: z.array(z.string()).default([]),
        }),
      )
      .min(1),
  ),
});

type RawReadiness = z.infer<typeof resumeReadinessSchema>;
export type ResumeReadiness = Omit<RawReadiness, "fixes"> & {
  fixes: Omit<RawReadiness["fixes"][number], "new_claims">[];
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”"'‘’`]/g, "")
    .replace(/[^a-z0-9%$]+/g, " ")
    .trim();

/**
 * The candidate may paste these fixes into a real application, so only honest ones survive:
 * - the "where" must actually be in the resume (not invented or paraphrased), and
 * - a rewrite must add no new claims by the model's own admission (else it's inflating).
 */
function keepHonestFixes(r: RawReadiness, resumeText: string): ResumeReadiness {
  const resume = normalize(resumeText);
  const fixes = r.fixes
    .filter((f) => {
      const where = normalize(f.where);
      // Long quotes may be trimmed or lightly reflowed by the model: match on their first 8 words.
      const probe = where.split(" ").slice(0, 8).join(" ");
      const anchored = probe.length >= 3 && resume.includes(probe);
      const honest = f.kind === "add_if_true" || f.new_claims.every((c) => !c.trim());
      return anchored && honest;
    })
    .map(({ new_claims: _unused, ...fix }) => fix);
  if (fixes.length < r.fixes.length) {
    console.warn(`Resume readiness: dropped ${r.fixes.length - fixes.length} fix(es) that weren't anchored or added claims`);
  }
  return { ...r, fixes };
}

/**
 * First-scan resume assessment against the JD. Runs alongside the question plan and is a
 * nice-to-have: it never throws, returning null so the session is still created.
 */
export async function assessResumeReadiness(input: ResumeReadinessPromptInput): Promise<ResumeReadiness | null> {
  const { system, user } = resumeReadinessPrompt(input);
  for (const attempt of [1, 2]) {
    try {
      const completion = await openai.chat.completions.create(
        {
          model: MODEL,
          // Reasoning model: no temperature; low effort keeps it inside the question plan's time.
          reasoning_effort: "low",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        { timeout: 30_000 },
      );
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("empty completion");
      return keepHonestFixes(resumeReadinessSchema.parse(JSON.parse(content)), input.resumeText);
    } catch (err) {
      const reason = err instanceof z.ZodError ? `schema mismatch: ${z.prettifyError(err)}` : String(err);
      console.warn(`Resume readiness attempt ${attempt} failed: ${reason}`);
    }
  }
  console.error(`Resume readiness unavailable for role "${input.roleTitle}" — session created without it`);
  return null;
}
