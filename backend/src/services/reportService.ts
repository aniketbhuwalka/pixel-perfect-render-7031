import { z } from "zod";
import { HttpError } from "../lib/errors.js";
import { openai } from "../lib/openai.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { fillerWordCount, wordCount } from "../lib/text.js";
import { reportPrompt } from "../prompts/report.js";
import { unpackAnalysis } from "../lib/sessionAnalysis.js";

const MODEL = "gpt-4o-mini";

type QuestionRow = { id: string; text: string; order_index: number };
type TurnRow = {
  question_id: string | null;
  speaker: "interviewer" | "candidate";
  text: string;
  is_followup: boolean;
  started_at: string;
  ended_at: string | null;
};

/* ------------------------------------------------------------------ */
/* Transcript → answers + measured metrics (deterministic, no AI)      */
/* ------------------------------------------------------------------ */

type StitchedAnswer = {
  question: QuestionRow;
  answer_text: string;
  word_count: number;
  speaking_seconds: number | null;
};

/**
 * One answer per question: all candidate turns attributed to it, main answer + follow-up replies.
 * Candidate turns without a question_id belong to the most recent question asked before them.
 */
export function stitchAnswers(questions: QuestionRow[], turns: TurnRow[]): StitchedAnswer[] {
  const byQuestion = new Map<string, TurnRow[]>(questions.map((q) => [q.id, []]));
  let current: string | null = null;
  for (const t of turns) {
    if (t.question_id && byQuestion.has(t.question_id)) current = t.question_id;
    if (t.speaker !== "candidate") continue;
    const qid = t.question_id && byQuestion.has(t.question_id) ? t.question_id : current;
    if (qid) byQuestion.get(qid)!.push(t);
  }

  return questions.map((question) => {
    const qTurns = byQuestion.get(question.id)!;
    const answer_text = qTurns.map((t) => t.text.trim()).join(" ").trim();
    const timed = qTurns.filter((t) => t.ended_at);
    const seconds = timed.reduce((s, t) => s + Math.max(0, Date.parse(t.ended_at!) - Date.parse(t.started_at)) / 1000, 0);
    return {
      question,
      answer_text,
      word_count: wordCount(answer_text),
      speaking_seconds: timed.length ? Math.round(seconds) : null,
    };
  });
}

export function measureCommunication(answers: StitchedAnswer[]) {
  const answered = answers.filter((a) => a.word_count > 0);
  const totalWords = answered.reduce((s, a) => s + a.word_count, 0);
  const timed = answered.filter((a) => a.speaking_seconds);
  const timedWords = timed.reduce((s, a) => s + a.word_count, 0);
  const timedSeconds = timed.reduce((s, a) => s + (a.speaking_seconds ?? 0), 0);
  return {
    filler_word_count: answered.reduce((s, a) => s + fillerWordCount(a.answer_text), 0),
    avg_words_per_answer: answered.length ? Math.round(totalWords / answered.length) : 0,
    // Only computable when the client sent turn start/end times.
    pace_wpm: timedSeconds > 0 ? Math.round(timedWords / (timedSeconds / 60)) : null,
  };
}

function formatTranscript(turns: TurnRow[], questions: QuestionRow[]): string {
  const number = new Map(questions.map((q, i) => [q.id, i + 1]));
  return turns
    .map((t) => {
      const tag = t.question_id && number.has(t.question_id) ? ` [Q${number.get(t.question_id)}${t.is_followup ? " follow-up" : ""}]` : "";
      return `${t.speaker === "interviewer" ? "Interviewer" : "Candidate"}${tag}: ${t.text.trim()}`;
    })
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Model output schema                                                 */
/* ------------------------------------------------------------------ */

const str = z.string().trim().min(1);
// Counts are asked for in the prompt; validation trims extras rather than failing a good report.
const list = <T extends z.ZodType>(item: T, max: number) =>
  z.preprocess((v) => (Array.isArray(v) ? v.slice(0, max) : v), z.array(item).min(1));
const score = (max: number) => z.number().min(0).max(max).transform(Math.round);

function reportSchema(questionCount: number) {
  return z.object({
    overall_score: score(100),
    verdict_line: str,
    what_worked: list(str, 5),
    what_didnt_work: list(str, 5),
    strengths: list(z.object({ trait: str, evidence: str }), 3),
    weaknesses: list(z.object({ pattern: str, fix: str }), 3),
    communication: z.object({ used_star_structure: z.boolean() }).loose(),
    jd_fit_summary: str,
    per_question: z
      .array(
        z.object({
          question: z.string(),
          answer_text: z.string(),
          score: score(10),
          what_was_missing: z.array(z.string()),
          model_answer: z.string(),
        }),
      )
      .length(questionCount),
    top_3_actions: list(str, 3),
  });
}

type ModelReport = z.infer<ReturnType<typeof reportSchema>>;

type ReportContent = {
  overall_score: number;
  verdict_line: string;
  what_worked: string[];
  what_didnt_work: string[];
  strengths: { trait: string; evidence: string }[];
  weaknesses: { pattern: string; fix: string }[];
  communication: ReturnType<typeof measureCommunication> & { used_star_structure: boolean | null };
  jd_fit_summary: string;
  top_3_actions: string[];
  per_question: { score: number; what_was_missing: string[]; model_answer: string }[];
};

async function requestReport(prompt: { system: string; user: string }, questionCount: number, temperature: number) {
  const completion = await openai.chat.completions.create(
    {
      model: MODEL,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    },
    { timeout: 60_000 },
  );
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error(`empty completion (finish_reason=${completion.choices[0]?.finish_reason})`);
  return reportSchema(questionCount).parse(JSON.parse(content));
}

/** Scores-only report used when the model can't produce a valid one. Clearly labelled as such. */
function reducedReport(answers: StitchedAnswer[], metrics: ReturnType<typeof measureCommunication>): ReportContent {
  // Crude, transparent heuristic: no answer = 0, otherwise scaled by how much was said.
  const per_question = answers.map((a) => ({
    score: a.word_count === 0 ? 0 : a.word_count < 20 ? 2 : a.word_count < 60 ? 4 : 6,
    what_was_missing: a.word_count === 0 ? ["No answer was recorded for this question."] : [],
    model_answer: "",
  }));
  const avg = per_question.reduce((s, q) => s + q.score, 0) / Math.max(per_question.length, 1);
  return {
    overall_score: Math.round(avg * 10),
    verdict_line:
      "We couldn't generate the full written debrief for this interview, so this report shows estimated scores only.",
    what_worked: [],
    what_didnt_work: [],
    strengths: [],
    weaknesses: [],
    communication: { ...metrics, used_star_structure: null },
    jd_fit_summary: "",
    top_3_actions: [],
    per_question,
  };
}

export async function generateReportContent(
  prompt: { system: string; user: string },
  answers: StitchedAnswer[],
  metrics: ReturnType<typeof measureCommunication>,
): Promise<{ content: ReportContent; reduced: boolean }> {
  if (answers.every((a) => a.word_count === 0)) {
    console.warn("Report: candidate said nothing, skipping the model and using the reduced report");
    return { content: reducedReport(answers, metrics), reduced: true };
  }

  const errors: string[] = [];
  for (const temperature of [0.3, 0]) {
    try {
      const r: ModelReport = await requestReport(prompt, answers.length, temperature);
      return {
        reduced: false,
        content: {
          ...r,
          // Measured numbers always win over anything the model wrote.
          communication: { ...metrics, used_star_structure: r.communication.used_star_structure },
        },
      };
    } catch (err) {
      const reason = err instanceof z.ZodError ? `schema mismatch: ${z.prettifyError(err)}` : String(err);
      errors.push(`[temp ${temperature}] ${reason}`);
      console.warn(`Report attempt failed at temperature ${temperature}: ${reason}`);
    }
  }
  console.error(`!!!!! REDUCED REPORT USED — both OpenAI attempts failed !!!!!\n${errors.join("\n")}`);
  return { content: reducedReport(answers, metrics), reduced: true };
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

// Two simultaneous calls for the same session share one generation (single-instance deploy).
const inFlight = new Map<string, Promise<unknown>>();

export async function createOrGetReport(userId: string, sessionId: string) {
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("id, role_title, jd_text, gap_map, resume_id, status, started_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Session lookup failed: ${error.message}`);
  if (!session) throw new HttpError(404, "session_not_found", "Session not found.");

  const existing = await loadReport(sessionId);
  if (existing) {
    if (session.status !== "completed") await completeSession(sessionId, session.started_at, null);
    return existing;
  }

  const running = inFlight.get(sessionId);
  if (running) return running;
  const job = generateAndStore(userId, session).finally(() => inFlight.delete(sessionId));
  inFlight.set(sessionId, job);
  return job;
}

async function generateAndStore(
  userId: string,
  session: { id: string; role_title: string; jd_text: string; gap_map: unknown; resume_id: string | null; started_at: string | null },
) {
  const sessionId = session.id;
  const [questionsRes, turnsRes, resumeRes] = await Promise.all([
    supabaseAdmin.from("questions").select("id, text, order_index").eq("session_id", sessionId).order("order_index"),
    supabaseAdmin
      .from("turns")
      .select("question_id, speaker, text, is_followup, started_at, ended_at")
      .eq("session_id", sessionId)
      .order("started_at"),
    session.resume_id
      ? supabaseAdmin.from("resumes").select("extracted_text").eq("id", session.resume_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (questionsRes.error) throw new Error(`Questions lookup failed: ${questionsRes.error.message}`);
  if (turnsRes.error) throw new Error(`Turns lookup failed: ${turnsRes.error.message}`);
  if (resumeRes.error) throw new Error(`Resume lookup failed: ${resumeRes.error.message}`);
  const questions = questionsRes.data as QuestionRow[];
  const turns = turnsRes.data as TurnRow[];
  if (!questions.length) throw new HttpError(409, "session_has_no_questions", "This session has no questions.");

  const answers = stitchAnswers(questions, turns);
  const metrics = measureCommunication(answers);

  // Clear any partial rows from an earlier attempt that crashed before the report was saved.
  const questionIds = questions.map((q) => q.id);
  const { data: stale } = await supabaseAdmin.from("answers").select("id").in("question_id", questionIds);
  if (stale?.length) {
    const staleIds = stale.map((a) => a.id);
    await supabaseAdmin.from("feedback").delete().in("answer_id", staleIds);
    await supabaseAdmin.from("answers").delete().in("id", staleIds);
  }

  const { data: answerRows, error: answersError } = await supabaseAdmin
    .from("answers")
    .insert(
      answers.map((a) => ({
        question_id: a.question.id,
        user_id: userId,
        answer_text: a.answer_text,
        word_count: a.word_count,
        speaking_seconds: a.speaking_seconds,
      })),
    )
    .select("id, question_id");
  if (answersError || !answerRows) throw new Error(`Answers insert failed: ${answersError?.message ?? "no rows"}`);
  const answerIdByQuestion = new Map(answerRows.map((r) => [r.question_id as string, r.id as string]));

  const gapMap = unpackAnalysis(session.gap_map).requirements;
  const prompt = reportPrompt({
    roleTitle: session.role_title,
    jdText: session.jd_text ?? "",
    resumeText: resumeRes.data?.extracted_text ?? "",
    gapMapText: gapMap.length
      ? gapMap.map((g) => `- [${g.status}] ${g.requirement}: ${g.evidence}`).join("\n")
      : "No gap analysis available.",
    transcript: formatTranscript(turns, questions),
    questionsWithAnswers: answers.map((a) => ({ question: a.question.text, answer: a.answer_text })),
    metrics,
  });
  const { content, reduced } = await generateReportContent(prompt, answers, metrics);

  // Feedback first, report row last: the report row is the "done" marker for idempotency.
  const { error: feedbackError } = await supabaseAdmin.from("feedback").insert(
    answers.map((a, i) => ({
      answer_id: answerIdByQuestion.get(a.question.id),
      score: content.per_question[i]!.score,
      gaps: content.per_question[i]!.what_was_missing,
      model_answer: content.per_question[i]!.model_answer || null,
    })),
  );
  if (feedbackError) throw new Error(`Feedback insert failed: ${feedbackError.message}`);

  const { error: reportError } = await supabaseAdmin.from("session_reports").insert({
    session_id: sessionId,
    overall_score: content.overall_score,
    verdict_line: content.verdict_line,
    what_worked: content.what_worked,
    what_didnt_work: content.what_didnt_work,
    strengths: content.strengths,
    weaknesses: content.weaknesses,
    communication: content.communication,
    jd_fit_summary: content.jd_fit_summary,
    top_3_actions: content.top_3_actions,
  });
  if (reportError) throw new Error(`Report insert failed: ${reportError.message}`);

  await completeSession(sessionId, session.started_at, turns);
  console.log(`Report created session=${sessionId} user=${userId} reduced=${reduced} score=${content.overall_score}`);
  return (await loadReport(sessionId))!;
}

async function completeSession(sessionId: string, sessionStartedAt: string | null, turns: TurnRow[] | null) {
  const endedAt = new Date();
  // Prefer the real conversation span from the turns; fall back to the session's creation time.
  const first = turns?.[0]?.started_at ?? sessionStartedAt;
  const last = turns?.length ? turns[turns.length - 1]! : null;
  const end = last ? Date.parse(last.ended_at ?? last.started_at) : endedAt.getTime();
  const duration = first ? Math.max(0, Math.round((end - Date.parse(first)) / 1000)) : null;

  const { error } = await supabaseAdmin
    .from("sessions")
    .update({ status: "completed", ended_at: endedAt.toISOString(), duration_seconds: duration })
    .eq("id", sessionId);
  if (error) console.error(`Failed to mark session ${sessionId} completed: ${error.message}`);
}

/** Reads a stored report back into the API response shape. Returns null if none exists yet. */
export async function loadReport(sessionId: string) {
  const { data: report, error } = await supabaseAdmin
    .from("session_reports")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Report lookup failed: ${error.message}`);
  if (!report) return null;

  const { data: questions } = await supabaseAdmin
    .from("questions")
    .select("id, text, order_index")
    .eq("session_id", sessionId)
    .order("order_index");
  const qIds = (questions ?? []).map((q) => q.id);
  const { data: answers } = qIds.length
    ? await supabaseAdmin.from("answers").select("id, question_id, answer_text").in("question_id", qIds)
    : { data: [] };
  const aIds = (answers ?? []).map((a) => a.id);
  const { data: feedback } = aIds.length
    ? await supabaseAdmin.from("feedback").select("answer_id, score, gaps, model_answer").in("answer_id", aIds)
    : { data: [] };

  const answerByQ = new Map((answers ?? []).map((a) => [a.question_id, a]));
  const feedbackByA = new Map((feedback ?? []).map((f) => [f.answer_id, f]));

  return {
    id: report.id as string,
    session_id: sessionId,
    overall_score: report.overall_score as number,
    verdict_line: report.verdict_line as string,
    what_worked: report.what_worked as string[],
    what_didnt_work: report.what_didnt_work as string[],
    strengths: report.strengths as { trait: string; evidence: string }[],
    weaknesses: report.weaknesses as { pattern: string; fix: string }[],
    communication: report.communication,
    jd_fit_summary: report.jd_fit_summary as string,
    top_3_actions: report.top_3_actions as string[],
    per_question: (questions ?? []).map((q) => {
      const a = answerByQ.get(q.id);
      const f = a ? feedbackByA.get(a.id) : undefined;
      return {
        question_id: q.id as string,
        question: q.text as string,
        answer_text: (a?.answer_text as string) ?? "",
        score: (f?.score as number) ?? 0,
        what_was_missing: (f?.gaps as string[]) ?? [],
        model_answer: (f?.model_answer as string) ?? "",
      };
    }),
    // A reduced report is the only kind with no qualitative content.
    reduced: !(report.what_worked as unknown[])?.length && !(report.strengths as unknown[])?.length,
    created_at: report.created_at as string,
  };
}
