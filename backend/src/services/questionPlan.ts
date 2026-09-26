import { z } from "zod";
import { openai } from "../lib/openai.js";
import { questionPlanPrompt, type QuestionPlanPromptInput } from "../prompts/questionPlan.js";

const MODEL = "gpt-4o-mini";
const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 } as const;
const REQUIRED_MIX = { behavioural: 2, role_specific: 2, gap_targeted: 1 } as const;

const gapItem = z.object({
  requirement: z.string().trim().min(1),
  status: z.enum(["strong", "partial", "missing"]),
  evidence: z.string().trim().min(1),
});

const question = z.object({
  text: z.string().trim().min(1),
  type: z.enum(["behavioural", "role_specific", "gap_targeted"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const questionPlanSchema = z.object({
  candidate_first_name: z.string().trim().transform((n) => n || "there"),
  // "Most important first", so trimming an over-long list keeps the best items.
  gap_map: z.preprocess((v) => (Array.isArray(v) ? v.slice(0, 8) : v), z.array(gapItem).min(5)),
  questions: z
    .array(question)
    .length(5)
    .refine(
      (qs) => Object.entries(REQUIRED_MIX).every(([type, n]) => qs.filter((q) => q.type === type).length === n),
      { message: "questions must be 2 behavioural, 2 role_specific, 1 gap_targeted" },
    )
    // Enforce easy → hard regardless of what the model did (stable sort keeps its order within a level).
    .transform((qs) => [...qs].sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty])),
});

export type QuestionPlan = z.infer<typeof questionPlanSchema>;
export type GapMap = QuestionPlan["gap_map"];
export type PlannedQuestion = QuestionPlan["questions"][number];

async function requestPlan(input: QuestionPlanPromptInput, temperature: number): Promise<QuestionPlan> {
  const { system, user } = questionPlanPrompt(input);
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error(`empty completion (finish_reason=${completion.choices[0]?.finish_reason})`);
  return questionPlanSchema.parse(JSON.parse(content));
}

/**
 * Generates the gap map + question plan. Never throws: tries once at 0.4, retries once at 0,
 * then falls back to a generic plan so the user always gets a session.
 */
export async function generateQuestionPlan(
  input: QuestionPlanPromptInput,
): Promise<{ plan: QuestionPlan; source: "model" | "fallback" }> {
  const errors: string[] = [];
  for (const temperature of [0.4, 0]) {
    try {
      return { plan: await requestPlan(input, temperature), source: "model" };
    } catch (err) {
      const reason = err instanceof z.ZodError ? `schema mismatch: ${z.prettifyError(err)}` : String(err);
      errors.push(`[temp ${temperature}] ${reason}`);
      console.warn(`Question plan attempt failed at temperature ${temperature}: ${reason}`);
    }
  }

  console.error(
    `!!!!! QUESTION PLAN FALLBACK USED for role "${input.roleTitle}" — both OpenAI attempts failed !!!!!\n` +
      errors.join("\n"),
  );
  return { plan: fallbackPlan(input.roleTitle), source: "fallback" };
}

export function fallbackPlan(roleTitle: string): QuestionPlan {
  const role = roleTitle.trim() || "this";
  return {
    candidate_first_name: "there",
    gap_map: [],
    questions: [
      {
        type: "behavioural",
        difficulty: "easy",
        text: `To start us off, could you walk me through your background and what drew you to this ${role} role?`,
      },
      {
        type: "behavioural",
        difficulty: "medium",
        text: "Tell me about a time you had to deliver something important under a tight deadline, and how you handled it.",
      },
      {
        type: "role_specific",
        difficulty: "medium",
        text: `What do you see as the most important responsibilities of a ${role}, and how has your experience prepared you for them?`,
      },
      {
        type: "role_specific",
        difficulty: "hard",
        text: "Walk me through a project you're proud of that's relevant to this role — what exactly was your part, and what was the outcome?",
      },
      {
        type: "gap_targeted",
        difficulty: "hard",
        text: "Which part of this role would be the biggest stretch for you, and how would you get up to speed quickly?",
      },
    ],
  };
}
