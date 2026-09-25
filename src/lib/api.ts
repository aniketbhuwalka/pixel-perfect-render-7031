/**
 * Single swap point between mock data and the real external Node API.
 *
 * Set VITE_API_URL to switch to the real API. Every network call sends the
 * Supabase JWT as a Bearer token. When VITE_API_URL is absent, realistic mock
 * data is returned instead so every screen renders end to end.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  mockQuestions,
  mockReport,
  mockSession,
  mockSessionHistory,
  mockTurns,
} from "./mock-data";

export type InterviewMode = "voice" | "text";

export type ApiQuestion = {
  id: string;
  session_id: string;
  text: string;
  type: string;
  difficulty: string;
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

export type GapMap = { covered: string[]; gaps: string[] };

export type ApiSession = {
  id: string;
  role_title: string;
  jd_text: string;
  mode: InterviewMode;
  status: string;
  candidate_first_name: string | null;
  gap_map: GapMap;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
};

export type PerQuestionFeedback = {
  question_id: string;
  question: string;
  answer_text: string;
  score: number;
  missing: string;
  model_answer: string;
};

export type ApiReport = {
  id: string;
  session_id: string;
  overall_score: number;
  verdict_line: string;
  what_worked: string[];
  what_didnt_work: string[];
  strengths: string[];
  weaknesses: string[];
  communication: {
    clarity: number;
    structure: number;
    filler_words: number;
    pace_wpm: number;
  };
  jd_fit_summary: string;
  top_3_actions: string[];
  per_question: PerQuestionFeedback[];
  created_at: string;
};

export type SessionSummary = {
  id: string;
  role_title: string;
  mode: InterviewMode;
  status: string;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(await authHeaders()),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
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
    questions: ApiQuestion[];
  }> {
    if (API_URL) {
      return request("/api/sessions", { method: "POST", body: JSON.stringify(input) });
    }
    await delay(1800);
    const session_id = `session-${Date.now()}`;
    const questions = mockQuestions(session_id);
    const gap_map: GapMap = {
      covered: ["Measurement design", "Stakeholder management", "Delivery ownership"],
      gaps: ["Experimentation depth", "Warehouse modelling"],
    };
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
        status: "created",
        candidate_first_name,
        gap_map,
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: null,
      }),
      questions,
    };
    writeStore(store);
    return { session_id, candidate_first_name, gap_map, questions };
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
      existing.session.status = "complete";
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
