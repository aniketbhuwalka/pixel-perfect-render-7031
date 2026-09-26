import type { ApiQuestion, InterviewMode } from "@/lib/api";

export type InterviewStatus =
  "idle" | "connecting" | "interviewer_speaking" | "listening" | "thinking" | "ended" | "error";

export type TranscriptTurn = {
  id: string;
  speaker: "interviewer" | "candidate";
  text: string;
  timestamp: string;
  /** epoch ms, used to keep turns in true speaking order */
  startedAt: number;
  isFollowup: boolean;
};

export type InterviewError = {
  /** API error code, e.g. "realtime_unavailable", "session_not_active", "connect_timeout" */
  code: string;
  message: string;
};

export type InterviewOptions = {
  sessionId: string;
  questions: ApiQuestion[];
  mode: InterviewMode;
};

export type UseInterviewSession = {
  status: InterviewStatus;
  mode: InterviewMode;
  currentQuestionIndex: number;
  totalQuestions: number;
  isInterviewerSpeaking: boolean;
  isCandidateSpeaking: boolean;
  /** what the interviewer is saying right now */
  captions: string;
  /** live transcription of what the candidate is saying right now */
  candidateCaption: string;
  transcript: TranscriptTurn[];
  error: InterviewError | null;
  muted: boolean;
  start: () => void;
  repeat: () => void;
  skip: () => void;
  toggleMute: () => void;
  /** text mode: send a typed answer */
  sendText: (text: string) => void;
  /** closes the connection after flushing any in-flight transcripts and turn saves */
  end: () => Promise<void>;
  /** loudness 0–1 of the interviewer's voice right now (drives the avatar's mouth) */
  getOutputLevel: () => number;
  /** loudness 0–1 of the candidate's mic right now */
  getInputLevel: () => number;
};

export const clockTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
