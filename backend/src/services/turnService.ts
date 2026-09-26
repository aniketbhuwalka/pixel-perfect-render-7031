import { HttpError } from "../lib/errors.js";
import { supabaseAdmin } from "../lib/supabase.js";

export type SaveTurnInput = {
  userId: string;
  sessionId: string;
  questionId: string | null;
  speaker: "interviewer" | "candidate";
  text: string;
  isFollowup: boolean;
  startedAt?: string;
  endedAt?: string;
};

/** Hot path during a live interview: two indexed lookups in parallel, one insert, maybe one update. */
export async function saveTurn(input: SaveTurnInput) {
  const { userId, sessionId, questionId } = input;

  const [sessionRes, questionRes] = await Promise.all([
    supabaseAdmin.from("sessions").select("status").eq("id", sessionId).eq("user_id", userId).maybeSingle(),
    questionId
      ? supabaseAdmin.from("questions").select("asked_at").eq("id", questionId).eq("session_id", sessionId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (sessionRes.error) throw new Error(`Session lookup failed: ${sessionRes.error.message}`);
  if (!sessionRes.data) throw new HttpError(404, "session_not_found", "Session not found.");
  if (sessionRes.data.status !== "in_progress") {
    throw new HttpError(409, "session_not_active", `This session is ${sessionRes.data.status}, not in progress.`);
  }
  if (questionRes.error) throw new Error(`Question lookup failed: ${questionRes.error.message}`);
  if (questionId && !questionRes.data) {
    throw new HttpError(400, "invalid_question", "question_id does not belong to this session.");
  }

  const { data: turn, error } = await supabaseAdmin
    .from("turns")
    .insert({
      session_id: sessionId,
      question_id: questionId,
      speaker: input.speaker,
      text: input.text,
      is_followup: input.isFollowup,
      ...(input.startedAt ? { started_at: input.startedAt } : {}),
      ...(input.endedAt ? { ended_at: input.endedAt } : {}),
    })
    .select("id")
    .single();
  if (error || !turn) throw new Error(`Turn insert failed: ${error?.message ?? "no row"}`);

  // Stamp the question the first time it's asked. The `is null` filter makes this race-safe.
  if (questionId && !questionRes.data?.asked_at) {
    const { error: stampError } = await supabaseAdmin
      .from("questions")
      .update({ asked_at: input.startedAt ?? new Date().toISOString() })
      .eq("id", questionId)
      .is("asked_at", null);
    if (stampError) console.warn(`asked_at stamp failed for question ${questionId}: ${stampError.message}`);
  }

  return { ok: true as const, turn_id: turn.id as string };
}
