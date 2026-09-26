import { HttpError } from "../lib/errors.js";
import { supabaseAdmin } from "../lib/supabase.js";
import type { SessionAnalysis } from "../lib/sessionAnalysis.js";
import { generateQuestionPlan } from "./questionPlan.js";
import { assessResumeReadiness } from "./resumeReadiness.js";

export type CreateSessionInput = {
  userId: string;
  resumeId: string;
  roleTitle: string;
  jdText: string;
  mode: "voice" | "text";
};

export async function createSession({ userId, resumeId, roleTitle, jdText, mode }: CreateSessionInput) {
  // Service role bypasses RLS, so ownership must be checked here. A resume the user doesn't
  // own gets the same 404 as one that doesn't exist.
  const { data: resume, error: resumeError } = await supabaseAdmin
    .from("resumes")
    .select("extracted_text")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (resumeError) throw new Error(`Resume lookup failed: ${resumeError.message}`);
  if (!resume) throw new HttpError(404, "resume_not_found", "Resume not found.");

  // Both calls read the same inputs and are independent, so run them side by side:
  // the readiness assessment adds no wait, and it can't fail the session (null on failure).
  const planInput = { roleTitle, jdText, resumeText: resume.extracted_text ?? "" };
  const [{ plan, source }, resumeReadiness] = await Promise.all([
    generateQuestionPlan(planInput),
    assessResumeReadiness(planInput),
  ]);
  const analysis: SessionAnalysis = { requirements: plan.gap_map, resume_readiness: resumeReadiness };

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .insert({
      user_id: userId,
      resume_id: resumeId,
      role_title: roleTitle,
      jd_text: jdText,
      mode,
      gap_map: analysis,
      candidate_first_name: plan.candidate_first_name,
    })
    .select("id")
    .single();
  if (sessionError || !session) throw new Error(`Session insert failed: ${sessionError?.message ?? "no row"}`);

  // supabase-js can't open a transaction, so: one multi-row insert (atomic on its own), and if
  // it fails, delete the session so no half-built session is ever left behind.
  const { data: questions, error: questionsError } = await supabaseAdmin
    .from("questions")
    .insert(
      plan.questions.map((q, i) => ({
        session_id: session.id,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        order_index: i,
      })),
    )
    .select("id, session_id, text, type, difficulty, order_index, asked_at")
    .order("order_index");

  if (questionsError || !questions) {
    await supabaseAdmin.from("questions").delete().eq("session_id", session.id);
    await supabaseAdmin.from("sessions").delete().eq("id", session.id);
    throw new Error(`Questions insert failed, session rolled back: ${questionsError?.message ?? "no rows"}`);
  }

  console.log(
    `Session ${session.id} created (plan source: ${source}, ${questions.length} questions, resume readiness: ${resumeReadiness ? resumeReadiness.score : "unavailable"})`,
  );
  return {
    session_id: session.id as string,
    candidate_first_name: plan.candidate_first_name,
    gap_map: plan.gap_map,
    resume_readiness: resumeReadiness,
    questions,
  };
}
