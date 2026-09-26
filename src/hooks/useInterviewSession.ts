import { usingMockApi } from "@/lib/api";
import { useMockInterview } from "./useMockInterview";
import { useRealtimeInterview } from "./useRealtimeInterview";

export type { InterviewStatus, TranscriptTurn, UseInterviewSession } from "./interviewTypes";

/** Real OpenAI Realtime interview when an API is configured, scripted demo otherwise. */
export const useInterviewSession = usingMockApi ? useMockInterview : useRealtimeInterview;
