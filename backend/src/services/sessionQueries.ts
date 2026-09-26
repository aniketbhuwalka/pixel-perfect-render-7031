import { HttpError } from "../lib/errors.js";
import { unpackAnalysis } from "../lib/sessionAnalysis.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { loadReport } from "./reportService.js";

const SESSION_FIELDS =
  "id, resume_id, role_title, jd_text, mode, status, candidate_first_name, gap_map, started_at, ended_at, duration_seconds";

/** History list: newest first, with the overall score when a report exists. */
export async function listSessions(userId: string) {
  const { data: sessions, error } = await supabaseAdmin
    .from("sessions")
    .select("id, role_title, mode, status, started_at, duration_seconds")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Session list failed: ${error.message}`);
  if (!sessions.length) return { sessions: [] };

  const { data: reports, error: reportsError } = await supabaseAdmin
    .from("session_reports")
    .select("session_id, overall_score")
    .in(
      "session_id",
      sessions.map((s) => s.id),
    );
  if (reportsError) throw new Error(`Report scores lookup failed: ${reportsError.message}`);
  const scoreBySession = new Map(reports.map((r) => [r.session_id, r.overall_score as number]));

  return {
    sessions: sessions.map((s) => ({ ...s, overall_score: scoreBySession.get(s.id) ?? null })),
  };
}

/** Everything the interview room, report and replay screens need for one session. */
export async function getSessionDetail(userId: string, sessionId: string) {
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select(SESSION_FIELDS)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Session lookup failed: ${error.message}`);
  if (!session) throw new HttpError(404, "session_not_found", "Session not found.");

  const [questionsRes, turnsRes, report] = await Promise.all([
    supabaseAdmin
      .from("questions")
      .select("id, session_id, text, type, difficulty, order_index, asked_at")
      .eq("session_id", sessionId)
      .order("order_index"),
    supabaseAdmin
      .from("turns")
      .select("id, session_id, question_id, speaker, text, is_followup, started_at, ended_at")
      .eq("session_id", sessionId)
      .order("started_at"),
    loadReport(sessionId),
  ]);
  if (questionsRes.error) throw new Error(`Questions lookup failed: ${questionsRes.error.message}`);
  if (turnsRes.error) throw new Error(`Turns lookup failed: ${turnsRes.error.message}`);
  const analysis = unpackAnalysis(session.gap_map);

  return {
    session: {
      ...session,
      gap_map: analysis.requirements,
      resume_readiness: analysis.resume_readiness,
    },
    questions: questionsRes.data,
    turns: turnsRes.data,
    report,
  };
}
