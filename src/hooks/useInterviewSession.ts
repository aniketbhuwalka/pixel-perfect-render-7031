/**
 * STUB. No WebRTC or audio logic lives here.
 *
 * Drives the Interview Room UI with mock data on a timer so the screen demos
 * standalone. The real OpenAI Realtime WebRTC implementation gets swapped in
 * later behind exactly this return shape.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiQuestion } from "@/lib/api";

export type InterviewStatus =
  | "idle"
  | "connecting"
  | "interviewer_speaking"
  | "listening"
  | "thinking"
  | "ended";

export type TranscriptTurn = {
  id: string;
  speaker: "interviewer" | "candidate";
  text: string;
  timestamp: string;
  isFollowup: boolean;
};

export type UseInterviewSession = {
  status: InterviewStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  isInterviewerSpeaking: boolean;
  isCandidateSpeaking: boolean;
  captions: string;
  transcript: TranscriptTurn[];
  start: () => void;
  repeat: () => void;
  skip: () => void;
  end: () => void;
};

const MOCK_ANSWERS = [
  "I've spent the last four years in product analytics, most recently owning payments reporting, and this role lines up with the measurement work I enjoy most.",
  "I led our billing reconciliation migration — I wrote the spec, ran the working group, and rebuilt the matching logic, which cut manual corrections by about seventy percent.",
  "I start from the decision the metric serves. On the checkout rework the data showed the drop was on the address step, not payment, so I dropped my hypothesis and reprioritised.",
  "A stakeholder wanted the dashboard before the model was stable. I showed two weeks of variance, agreed a narrow read-only view first, and we shipped the full thing a sprint later.",
  "The nightly aggregation fell over at ten times volume on a single-threaded join. Now I'd partition by merchant up front and load-test with realistic skew.",
];

const FOLLOWUPS = [
  "Thanks. And what part of that was specifically yours, rather than the team's?",
  "Got it. What would you measure differently if you started again?",
];

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function useInterviewSession(questions: ApiQuestion[] = []): UseInterviewSession {
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [captions, setCaptions] = useState("");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelled = useRef(false);
  const totalQuestions = questions.length;

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(
    () => () => {
      cancelled.current = true;
      clearTimers();
    },
    [clearTimers],
  );

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        timers.current.push(t);
      }),
    [],
  );

  /** Streams a line into the captions word by word, then commits it to the transcript. */
  const speak = useCallback(
    async (speaker: "interviewer" | "candidate", text: string, isFollowup = false) => {
      setStatus(speaker === "interviewer" ? "interviewer_speaking" : "listening");
      setCaptions("");
      const words = text.split(" ");
      for (let i = 0; i < words.length; i += 1) {
        if (cancelled.current) return;
        await wait(speaker === "interviewer" ? 105 : 130);
        if (cancelled.current) return;
        setCaptions(words.slice(0, i + 1).join(" "));
      }
      if (cancelled.current) return;
      setTranscript((prev) => [
        ...prev,
        {
          id: `${speaker}-${prev.length}-${Date.now()}`,
          speaker,
          text,
          timestamp: nowTime(),
          isFollowup,
        },
      ]);
      await wait(500);
    },
    [wait],
  );

  const runFrom = useCallback(
    async (startIndex: number) => {
      for (let i = startIndex; i < questions.length; i += 1) {
        if (cancelled.current) return;
        setCurrentQuestionIndex(i);
        await speak("interviewer", questions[i]?.text ?? "");
        if (cancelled.current) return;
        setStatus("thinking");
        await wait(900);
        await speak("candidate", MOCK_ANSWERS[i % MOCK_ANSWERS.length] ?? "");
        if (i === 1 || i === 3) {
          await speak("interviewer", FOLLOWUPS[i === 1 ? 0 : 1] ?? "", true);
          setStatus("thinking");
          await wait(700);
          await speak(
            "candidate",
            i === 1
              ? "The matching logic and the rollout plan were mine end to end; the team handled the downstream reporting changes."
              : "I'd have agreed the success metric with them in writing before the first build, not after.",
          );
        }
      }
      if (!cancelled.current) {
        setStatus("ended");
        setCaptions("That's everything from me — thank you for your time.");
      }
    },
    [questions, speak, wait],
  );

  const start = useCallback(() => {
    cancelled.current = false;
    clearTimers();
    setTranscript([]);
    setStatus("connecting");
    const t = setTimeout(() => {
      if (!cancelled.current) void runFrom(0);
    }, 1400);
    timers.current.push(t);
  }, [clearTimers, runFrom]);

  const repeat = useCallback(() => {
    cancelled.current = true;
    clearTimers();
    const index = currentQuestionIndex;
    const t = setTimeout(() => {
      cancelled.current = false;
      void (async () => {
        await speak("interviewer", questions[index]?.text ?? "Let me repeat the question.");
        if (!cancelled.current) await runFrom(index);
      })();
    }, 120);
    timers.current.push(t);
  }, [clearTimers, currentQuestionIndex, questions, runFrom, speak]);

  const skip = useCallback(() => {
    cancelled.current = true;
    clearTimers();
    const next = currentQuestionIndex + 1;
    const t = setTimeout(() => {
      cancelled.current = false;
      if (next >= questions.length) {
        setStatus("ended");
        setCaptions("That's everything from me — thank you for your time.");
        return;
      }
      void runFrom(next);
    }, 120);
    timers.current.push(t);
  }, [clearTimers, currentQuestionIndex, questions.length, runFrom]);

  const end = useCallback(() => {
    cancelled.current = true;
    clearTimers();
    setStatus("ended");
    setCaptions("");
  }, [clearTimers]);

  return useMemo(
    () => ({
      status,
      currentQuestionIndex,
      totalQuestions,
      isInterviewerSpeaking: status === "interviewer_speaking",
      isCandidateSpeaking: status === "listening",
      captions,
      transcript,
      start,
      repeat,
      skip,
      end,
    }),
    [status, currentQuestionIndex, totalQuestions, captions, transcript, start, repeat, skip, end],
  );
}
