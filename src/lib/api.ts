/**
 * Single swap point between mock data and the real external Node API.
 *
 * Set VITE_API_URL to switch to the real API. Every network call sends the
 * Supabase JWT as a Bearer token. When VITE_API_URL is absent, realistic mock
 * data is returned instead so every screen renders end to end.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  mockGapMap,
  mockQuestions,
  mockResumeReadiness,
  mockReport,
  mockSession,
  mockSessionHistory,
  mockTurns,
} from "./mock-data";

export type InterviewMode = "voice" | "text";

export type QuestionType = "behavioural" | "role_specific" | "gap_targeted";
export type Difficulty = "easy" | "medium" | "hard";

export type ApiQuestion = {
  id: string;
  session_id: string;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  order_index: number;
  asked_at?: string | null;
};

export type ApiTurn = {
  id: string;
  session_id: string;
  question_id: string | null;
  speaker: "interviewer" | "candidate";
  text: string;
  is_followup: boolean;
  started_at: string;
  ended_at?: string | null;
};

export type GapStatus = "strong" | "partial" | "missing";
export type GapItem = { requirement: string; status: GapStatus; evidence: string };
export type GapMap = GapItem[];

export type SessionStatus = "in_progress" | "completed" | "abandoned";

export type ReadinessDimension = { score: number; note: string };

/** Hiring-manager first scan of the resume against this JD. */
export type ResumeReadiness = {
  score: number;
  verdict: string;
  dimensions: {
    structure: ReadinessDimension;
    clarity: ReadinessDimension;
    measurable_outcomes: ReadinessDimension;
    keyword_alignment: ReadinessDimension;
  };
  missing_keywords: string[];
  fixes: {
    /** rewrite = sharpen an existing line; add_if_true = only add if it's genuinely true */
    kind: "rewrite" | "add_if_true";
    where: string;
    fix: string;
    why: string;
  }[];
};

export type ApiSession = {
  id: string;
  resume_id: string | null;
  role_title: string;
  jd_text: string;
  mode: InterviewMode;
  status: SessionStatus;
  candidate_first_name: string | null;
  gap_map: GapMap;
  /** null when the assessment couldn't be generated (or for sessions created before it existed) */
  resume_readiness: ResumeReadiness | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
};

export type PerQuestionFeedback = {
  question_id: string;
  question: string;
  answer_text: string;
  score: number;
  what_was_missing: string[];
  model_answer: string;
};

export type ApiReport = {
  id: string;
  session_id: string;
  overall_score: number;
  verdict_line: string;
  what_worked: string[];
  what_didnt_work: string[];
  strengths: { trait: string; evidence: string }[];
  weaknesses: { pattern: string; fix: string }[];
  communication: {
    filler_word_count: number;
    avg_words_per_answer: number;
    /** null when the interview had no turn timings to measure pace from */
    pace_wpm: number | null;
    /** null on a reduced (scores-only) report */
    used_star_structure: boolean | null;
  };
  jd_fit_summary: string;
  top_3_actions: string[];
  per_question: PerQuestionFeedback[];
  /** true when the full debrief couldn't be generated and only scores are shown */
  reduced: boolean;
  created_at: string;
};

export type SessionSummary = {
  id: string;
  role_title: string;
  mode: InterviewMode;
  status: SessionStatus;
  started_at: string | null;
  duration_seconds: number | null;
  overall_score: number | null;
};

const API_URL = import.meta.env["VITE_API_URL"] as string | undefined;
export const usingMockApi = !API_URL;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Error from the API, carrying its status and machine-readable code (e.g. "realtime_unavailable"). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(await authHeaders()),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      "Can't reach the PrepPilot server. Check your connection and try again.",
      0,
      "network_error",
    );
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
      issues?: { path: string; message: string }[];
    } | null;
    const detail = body?.issues?.[0] ? ` (${body.issues[0].path}: ${body.issues[0].message})` : "";
    // The login is no longer valid: sign out so the auth guard sends the user back to /auth.
    if (res.status === 401) void supabase.auth.signOut();
    throw new ApiError(
      (body?.message ?? `Request failed (${res.status})`) + detail,
      res.status,
      body?.error ?? "unknown_error",
    );
  }
  return (await res.json()) as T;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Local demo store (mock mode only)                                   */
/* ------------------------------------------------------------------ */

const STORE_KEY = "preppilot.demo.sessions";

type StoredSession = { session: ApiSession; questions: ApiQuestion[]; report?: ApiReport };

function readStore(): Record<string, StoredSession> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, StoredSession>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

/* ------------------------------------------------------------------ */
/* API surface                                                         */
/* ------------------------------------------------------------------ */

export const api = {
  /** POST /api/resumes (multipart) */
  async uploadResume(file: File): Promise<{
    resume_id: string;
    extracted_text: string;
    char_count: number;
  }> {
    if (API_URL) {
      const form = new FormData();
      form.append("file", file);
      return request("/api/resumes", { method: "POST", body: form });
    }
    await delay(1600);
    const extracted_text = `Resume: ${file.name}\n\nSenior product analyst with four years across payments and marketplace teams. Owned billing reconciliation migration, cut manual corrections by 70%. Built checkout funnel measurement. Comfortable with SQL, dbt, Python.`;
    return {
      resume_id: `resume-${Date.now()}`,
      extracted_text,
      char_count: extracted_text.length,
    };
  },

  /** POST /api/sessions */
  async createSession(input: {
    resume_id: string;
    role_title: string;
    jd_text: string;
    mode: InterviewMode;
  }): Promise<{
    session_id: string;
    candidate_first_name: string;
    gap_map: GapMap;
    resume_readiness: ResumeReadiness | null;
    questions: ApiQuestion[];
  }> {
    if (API_URL) {
      return request("/api/sessions", { method: "POST", body: JSON.stringify(input) });
    }
    await delay(1800);
    const session_id = `session-${Date.now()}`;
    const questions = mockQuestions(session_id);
    const gap_map: GapMap = mockGapMap;
    const { data } = await supabase.auth.getUser();
    const candidate_first_name =
      (data.user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ??
      data.user?.email?.split("@")[0] ??
      "there";
    const store = readStore();
    store[session_id] = {
      session: mockSession(session_id, {
        role_title: input.role_title,
        jd_text: input.jd_text,
        mode: input.mode,
        resume_id: input.resume_id,
        status: "in_progress",
        candidate_first_name,
        gap_map,
        resume_readiness: mockResumeReadiness,
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: null,
      }),
      questions,
    };
    writeStore(store);
    return {
      session_id,
      candidate_first_name,
      gap_map,
      resume_readiness: mockResumeReadiness,
      questions,
    };
  },

  /** POST /api/realtime/token */
  async createRealtimeToken(
    session_id: string,
  ): Promise<{ client_secret: string; expires_at: string; model: string }> {
    if (API_URL) {
      return request("/api/realtime/token", {
        method: "POST",
        body: JSON.stringify({ session_id }),
      });
    }
    await delay(700);
    return {
      client_secret: "mock-ephemeral-secret",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      model: "mock-realtime-model",
    };
  },

  /** POST /api/turns */
  async saveTurn(input: {
    session_id: string;
    question_id: string | null;
    speaker: "interviewer" | "candidate";
    text: string;
    is_followup: boolean;
    /** ISO timestamps; let the report compute real speaking time and pace */
    started_at?: string;
    ended_at?: string;
  }): Promise<{ ok: boolean; turn_id: string }> {
    if (API_URL) {
      return request("/api/turns", { method: "POST", body: JSON.stringify(input) });
    }
    return { ok: true, turn_id: `turn-${Date.now()}` };
  },

  /** POST /api/sessions/:id/report */
  async generateReport(session_id: string): Promise<ApiReport> {
    if (API_URL) {
      return request(`/api/sessions/${session_id}/report`, { method: "POST" });
    }
    await delay(2400);
    const report = mockReport(session_id);
    const store = readStore();
    const existing = store[session_id];
    if (existing) {
      existing.report = report;
      existing.session.status = "completed";
      existing.session.ended_at = new Date().toISOString();
      existing.session.duration_seconds = existing.session.duration_seconds ?? 1_080;
      writeStore(store);
    }
    return report;
  },

  /** GET /api/sessions */
  async listSessions(): Promise<{ sessions: SessionSummary[] }> {
    if (API_URL) return request("/api/sessions");
    await delay(600);
    const store = readStore();
    const local: SessionSummary[] = Object.values(store).map(({ session, report }) => ({
      id: session.id,
      role_title: session.role_title,
      mode: session.mode,
      status: session.status,
      started_at: session.started_at,
      duration_seconds: session.duration_seconds,
      overall_score: report?.overall_score ?? null,
    }));
    return {
      sessions: [...local, ...mockSessionHistory].sort(
        (a, b) => Date.parse(b.started_at ?? "") - Date.parse(a.started_at ?? ""),
      ),
    };
  },

  /** GET /api/sessions/:id */
  async getSession(id: string): Promise<{
    session: ApiSession;
    questions: ApiQuestion[];
    turns: ApiTurn[];
    report: ApiReport | null;
  }> {
    if (API_URL) return request(`/api/sessions/${id}`);
    await delay(700);
    const store = readStore();
    const stored = store[id];
    if (stored) {
      return {
        session: stored.session,
        questions: stored.questions,
        turns: mockTurns(id),
        report: stored.report ?? null,
      };
    }
    const demo = mockSessionHistory.find((s) => s.id === id);
    return {
      session: mockSession(id, {
        role_title: demo?.role_title ?? "Senior Product Analyst — Fintech",
        mode: demo?.mode ?? "voice",
        started_at: demo?.started_at ?? null,
        duration_seconds: demo?.duration_seconds ?? null,
      }),
      questions: mockQuestions(id),
      turns: mockTurns(id),
      report: mockReport(id, demo?.overall_score ?? 74),
    };
  },
};
