import { HttpError } from "../lib/errors.js";
import { openai } from "../lib/openai.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { interviewerInstructions } from "../prompts/interviewer.js";
import { unpackAnalysis } from "../lib/sessionAnalysis.js";

export const REALTIME_MODEL = "gpt-realtime-2.1";
const VOICE = "verse";
// The secret is only needed to open the WebRTC connection; the call itself outlives it.
const SECRET_TTL_SECONDS = 120;

const titleCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

/**
 * The name the candidate signed up with wins (it's what they want to be called); the name
 * parsed from the resume is the fallback. Resumes often shout names in caps, so normalise.
 */
async function preferredFirstName(userId: string, fromResume: string | null): Promise<string> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const signupName = (data.user?.user_metadata?.["full_name"] as string | undefined)?.trim().split(/\s+/)[0];
  const name = signupName || (fromResume && fromResume !== "there" ? fromResume.trim() : "");
  return name ? titleCase(name) : "there";
}

export async function mintRealtimeToken(userId: string, sessionId: string) {
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("role_title, jd_text, gap_map, candidate_first_name, status, resume_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Session lookup failed: ${error.message}`);
  if (!session) throw new HttpError(404, "session_not_found", "Session not found.");
  if (session.status !== "in_progress") {
    throw new HttpError(409, "session_not_active", `This session is ${session.status}, not in progress.`);
  }

  const [resumeRes, questionsRes] = await Promise.all([
    session.resume_id
      ? supabaseAdmin.from("resumes").select("extracted_text").eq("id", session.resume_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from("questions").select("text").eq("session_id", sessionId).order("order_index"),
  ]);
  if (resumeRes.error) throw new Error(`Resume lookup failed: ${resumeRes.error.message}`);
  if (questionsRes.error) throw new Error(`Questions lookup failed: ${questionsRes.error.message}`);
  if (!questionsRes.data?.length) throw new HttpError(409, "session_has_no_questions", "This session has no questions.");

  const instructions = interviewerInstructions({
    roleTitle: session.role_title,
    candidateFirstName: await preferredFirstName(userId, session.candidate_first_name),
    questions: questionsRes.data.map((q) => q.text as string),
    resumeText: resumeRes.data?.extracted_text ?? "",
    jdText: session.jd_text ?? "",
    gapMap: unpackAnalysis(session.gap_map).requirements,
  });

  let secret;
  try {
    secret = await openai.realtime.clientSecrets.create(
      {
        expires_after: { anchor: "created_at", seconds: SECRET_TTL_SECONDS },
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          instructions,
          audio: {
            input: {
              // Filters room noise so a cough or keyboard isn't mistaken for the start of an answer.
              noise_reduction: { type: "near_field" },
              turn_detection: { type: "server_vad", silence_duration_ms: 700 },
              // Needed for the candidate's words to arrive as text events (for saving turns).
              transcription: { model: "gpt-4o-mini-transcribe" },
            },
            output: { voice: VOICE },
          },
        },
      },
      { timeout: 10_000 },
    );
  } catch (err) {
    console.error(`Realtime token mint FAILED session=${sessionId} user=${userId}:`, err);
    throw new HttpError(503, "realtime_unavailable", "Voice interviews are unavailable right now. Please use text mode.");
  }

  console.log(
    `Realtime token minted session=${sessionId} user=${userId} model=${REALTIME_MODEL} expires_at=${secret.expires_at}`,
  );
  return {
    client_secret: secret.value,
    expires_at: new Date(secret.expires_at * 1000).toISOString(),
    model: REALTIME_MODEL,
  };
}
