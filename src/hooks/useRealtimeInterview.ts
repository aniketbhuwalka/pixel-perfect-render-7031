/**
 * Live interview over the OpenAI Realtime API (WebRTC).
 *
 * The backend mints a short-lived client secret with the interviewer instructions, voice and
 * turn detection already baked in, so the browser only has to connect, play audio, and
 * turn data-channel events into transcript turns (which are saved via POST /api/turns).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  clockTime,
  type InterviewError,
  type InterviewOptions,
  type InterviewStatus,
  type TranscriptTurn,
  type UseInterviewSession,
} from "./interviewTypes";
import { CLOSING_PHRASE, QuestionTracker } from "./questionTracker";

const CONNECT_TIMEOUT_MS = 10_000;
const FLUSH_TIMEOUT_MS = 3_000;

/** The subset of Realtime server-event fields this hook reads. */
type RealtimeEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  text?: string;
  item_id?: string;
  error?: unknown;
};

const levelBuffer = new Uint8Array(512);

/** Loudness 0–1 of whatever the analyser is hearing right now. */
function readLevel(analyser: AnalyserNode | null): number {
  if (!analyser) return 0;
  const buf = levelBuffer.subarray(0, analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += (v - 128) ** 2;
  return Math.min(1, (Math.sqrt(sum / buf.length) / 128) * 4);
}

function errorFrom(err: unknown): InterviewError {
  if (err instanceof ApiError) return { code: err.code, message: err.message };
  if (err instanceof Error && err.message === "connect_timeout") {
    return { code: "connect_timeout", message: "Connecting to the interviewer took too long." };
  }
  return {
    code: "connect_failed",
    message: err instanceof Error ? err.message : "Couldn't connect.",
  };
}

export function useRealtimeInterview({
  sessionId,
  questions,
  mode,
}: InterviewOptions): UseInterviewSession {
  const [status, setStatus] = useState<InterviewStatus>("idle");
  // -1 while the interviewer is still greeting the candidate
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [captions, setCaptions] = useState("");
  const [candidateCaption, setCandidateCaption] = useState("");
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [error, setError] = useState<InterviewError | null>(null);
  const [muted, setMuted] = useState(false);

  const pc = useRef<RTCPeerConnection | null>(null);
  const dc = useRef<RTCDataChannel | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const outputMeter = useRef<AnalyserNode | null>(null);
  const inputMeter = useRef<AnalyserNode | null>(null);
  const tracker = useRef(new QuestionTracker(questions));
  const speech = useRef(new Map<string, { start: number; end?: number }>());
  const pendingTranscripts = useRef(new Set<string>());
  const pendingSaves = useRef(new Set<Promise<unknown>>());
  const interviewerBuffer = useRef<{ text: string; startedAt: number } | null>(null);
  const closing = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    tracker.current = new QuestionTracker(questions);
  }, [questions]);

  const teardown = useCallback(() => {
    mic.current?.getTracks().forEach((t) => t.stop());
    dc.current?.close();
    pc.current?.close();
    if (audio.current) audio.current.srcObject = null;
    void audioCtx.current?.close();
    mic.current = null;
    dc.current = null;
    pc.current = null;
    audioCtx.current = null;
    outputMeter.current = null;
    inputMeter.current = null;
  }, []);

  /** Taps a stream so the avatar can react to how loud it is, without affecting playback. */
  const meter = useCallback((stream: MediaStream) => {
    const ctx = audioCtx.current;
    if (!ctx) return null;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    ctx.createMediaStreamSource(stream).connect(analyser);
    return analyser;
  }, []);

  useEffect(
    () => () => {
      alive.current = false;
      teardown();
    },
    [teardown],
  );

  const send = useCallback((event: Record<string, unknown>) => {
    if (dc.current?.readyState === "open") dc.current.send(JSON.stringify(event));
  }, []);

  const saveTurn = useCallback((turn: Parameters<typeof api.saveTurn>[0]) => {
    const attempt = () => api.saveTurn(turn);
    const p = attempt()
      .catch(() => new Promise((r) => setTimeout(r, 800)).then(attempt))
      .catch((err) => console.error("Failed to save turn", err))
      .finally(() => pendingSaves.current.delete(p));
    pendingSaves.current.add(p);
  }, []);

  const addTurn = useCallback((turn: TranscriptTurn) => {
    setTranscript((prev) => [...prev, turn].sort((a, b) => a.startedAt - b.startedAt));
  }, []);

  const finishInterviewerTurn = useCallback(
    (fullText?: string) => {
      const buf = interviewerBuffer.current;
      interviewerBuffer.current = null;
      const text = (fullText ?? buf?.text ?? "").trim();
      if (!text) return;
      const startedAt = buf?.startedAt ?? Date.now();
      const tag = tracker.current.classify(text);
      setCurrentQuestionIndex(tag.questionIndex);
      if (CLOSING_PHRASE.test(text)) closing.current = true;

      setCaptions(""); // the live text is now a final transcript turn
      addTurn({
        id: `i-${startedAt}`,
        speaker: "interviewer",
        text,
        startedAt,
        timestamp: clockTime(startedAt),
        isFollowup: tag.isFollowup,
      });
      saveTurn({
        session_id: sessionId,
        question_id: tag.questionIndex >= 0 ? (questions[tag.questionIndex]?.id ?? null) : null,
        speaker: "interviewer",
        text,
        is_followup: tag.isFollowup,
        started_at: new Date(startedAt).toISOString(),
        ended_at: new Date().toISOString(),
      });
      if (mode === "text") setStatus(closing.current ? "ended" : "listening");
    },
    [addTurn, mode, questions, saveTurn, sessionId],
  );

  const recordCandidateTurn = useCallback(
    (text: string, startedAt: number, endedAt: number | undefined) => {
      const clean = text.trim();
      if (!clean) return;
      tracker.current.candidateSpoke = true;
      const tag = tracker.current.last;
      addTurn({
        id: `c-${startedAt}`,
        speaker: "candidate",
        text: clean,
        startedAt,
        timestamp: clockTime(startedAt),
        isFollowup: tag.isFollowup,
      });
      saveTurn({
        session_id: sessionId,
        question_id: tag.questionIndex >= 0 ? (questions[tag.questionIndex]?.id ?? null) : null,
        speaker: "candidate",
        text: clean,
        is_followup: tag.isFollowup,
        // Typed answers have no speaking time, so no timings (keeps pace out of the report).
        ...(endedAt
          ? {
              started_at: new Date(startedAt).toISOString(),
              ended_at: new Date(endedAt).toISOString(),
            }
          : {}),
      });
    },
    [addTurn, questions, saveTurn, sessionId],
  );

  const onEvent = useCallback(
    (raw: MessageEvent<string>) => {
      let ev: RealtimeEvent;
      try {
        ev = JSON.parse(raw.data) as RealtimeEvent;
      } catch {
        return;
      }
      const itemId = ev.item_id ?? "";
      switch (ev.type) {
        // ---- interviewer (voice: audio transcript; text mode: text output) ----
        case "response.output_audio_transcript.delta":
        case "response.output_text.delta": {
          if (!interviewerBuffer.current)
            interviewerBuffer.current = { text: "", startedAt: Date.now() };
          interviewerBuffer.current.text += ev.delta ?? "";
          setCaptions(interviewerBuffer.current.text);
          setCandidateCaption("");
          setStatus("interviewer_speaking");
          break;
        }
        case "response.output_audio_transcript.done":
        case "response.output_text.done":
          finishInterviewerTurn(ev.transcript ?? ev.text);
          break;
        case "output_audio_buffer.started":
          setStatus("interviewer_speaking");
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setStatus(closing.current ? "ended" : "listening");
          break;

        // ---- candidate (voice) ----
        case "input_audio_buffer.speech_started":
          speech.current.set(itemId, { start: Date.now() });
          setCandidateSpeaking(true);
          setCandidateCaption("");
          setStatus("listening");
          break;
        case "input_audio_buffer.speech_stopped": {
          const s = speech.current.get(itemId);
          if (s) s.end = Date.now();
          pendingTranscripts.current.add(itemId);
          setCandidateSpeaking(false);
          setStatus("thinking");
          break;
        }
        case "conversation.item.input_audio_transcription.delta":
          setCandidateCaption((c) => c + (ev.delta ?? ""));
          break;
        case "conversation.item.input_audio_transcription.completed": {
          const s = speech.current.get(itemId);
          const endedAt = s?.end ?? Date.now();
          setCandidateCaption(""); // the live text is now a final transcript turn
          recordCandidateTurn(ev.transcript ?? "", s?.start ?? endedAt, endedAt);
          pendingTranscripts.current.delete(itemId);
          speech.current.delete(itemId);
          break;
        }
        case "conversation.item.input_audio_transcription.failed":
          setCandidateCaption("");
          pendingTranscripts.current.delete(itemId);
          break;

        case "error":
          // Non-fatal (e.g. cancelling a response that already finished); keep the call going.
          console.warn("Realtime error event", ev.error);
          break;
      }
    },
    [finishInterviewerTurn, recordCandidateTurn],
  );

  const connect = useCallback(async () => {
    const { client_secret } = await api.createRealtimeToken(sessionId);

    const peer = new RTCPeerConnection();
    pc.current = peer;
    const el = audio.current ?? new Audio();
    el.autoplay = true;
    audio.current = el;
    peer.ontrack = (e) => {
      const remote = e.streams[0] ?? null;
      el.srcObject = remote;
      void el.play().catch(() => undefined);
      if (remote) outputMeter.current = meter(remote);
    };

    if (mode === "voice") {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mic.current = stream;
      inputMeter.current = meter(stream);
      peer.addTrack(stream.getAudioTracks()[0]!, stream);
    } else {
      peer.addTransceiver("audio", { direction: "recvonly" });
    }

    const channel = peer.createDataChannel("oai-events");
    dc.current = channel;
    channel.onmessage = onEvent;
    const opened = new Promise<void>((resolve, reject) => {
      channel.onopen = () => resolve();
      channel.onerror = () => reject(new Error("The interview connection failed."));
    });

    await peer.setLocalDescription(await peer.createOffer());
    const res = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: peer.localDescription!.sdp,
      headers: { Authorization: `Bearer ${client_secret}`, "Content-Type": "application/sdp" },
    });
    if (!res.ok)
      throw new ApiError(
        "The voice service rejected the connection.",
        res.status,
        "realtime_unavailable",
      );
    await peer.setRemoteDescription({ type: "answer", sdp: await res.text() });
    await opened;

    peer.onconnectionstatechange = () => {
      if (
        ["failed", "disconnected"].includes(peer.connectionState) &&
        alive.current &&
        !closing.current
      ) {
        setError({
          code: "connection_lost",
          message: "The connection to the interviewer dropped.",
        });
        setStatus("error");
      }
    };

    if (mode === "text")
      send({ type: "session.update", session: { type: "realtime", output_modalities: ["text"] } });
    send({ type: "response.create" }); // the interviewer opens
  }, [meter, mode, onEvent, send, sessionId]);

  const start = useCallback(() => {
    teardown();
    // Created inside the click that starts the interview, so the browser allows audio.
    try {
      audioCtx.current = new AudioContext();
    } catch {
      audioCtx.current = null; // levels just stay at 0; the interview still works
    }
    closing.current = false;
    tracker.current = new QuestionTracker(questions);
    setCurrentQuestionIndex(-1);
    setTranscript([]);
    setCaptions("");
    setCandidateCaption("");
    setError(null);
    setStatus("connecting");

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("connect_timeout")), CONNECT_TIMEOUT_MS);
    });
    Promise.race([connect(), timeout])
      .then(() => {
        // Events may already have moved the status on (e.g. the interviewer started speaking).
        if (alive.current) setStatus((s) => (s === "connecting" ? "thinking" : s));
      })
      .catch((err) => {
        if (!alive.current) return;
        teardown();
        const e =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? { code: "mic_denied", message: "Microphone access was blocked." }
            : errorFrom(err);
        setError(e);
        setStatus("error");
      })
      .finally(() => clearTimeout(timer));
  }, [connect, questions, teardown]);

  const interrupt = useCallback(() => {
    send({ type: "response.cancel" });
    send({ type: "output_audio_buffer.clear" });
    interviewerBuffer.current = null;
    setCaptions(""); // the cut-off sentence won't become a turn, so drop its live text
  }, [send]);

  const steer = useCallback(
    (instruction: string) => {
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: instruction }],
        },
      });
      send({ type: "response.create" });
      setStatus("thinking");
    },
    [send],
  );

  const repeat = useCallback(() => {
    interrupt();
    tracker.current.repeatPending = true;
    steer("(Please repeat the current question, word for word.)");
  }, [interrupt, steer]);

  const skip = useCallback(() => {
    interrupt();
    tracker.current.skip();
    steer(
      "(The candidate would like to skip this question. Acknowledge briefly and ask the next question.)",
    );
  }, [interrupt, steer]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      mic.current?.getAudioTracks().forEach((t) => (t.enabled = m));
      return !m;
    });
  }, []);

  const sendText = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      recordCandidateTurn(clean, Date.now(), undefined);
      send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: clean }] },
      });
      send({ type: "response.create" });
      setStatus("thinking");
    },
    [recordCandidateTurn, send],
  );

  const getOutputLevel = useCallback(() => readLevel(outputMeter.current), []);
  const getInputLevel = useCallback(() => (muted ? 0 : readLevel(inputMeter.current)), [muted]);

  const end = useCallback(async () => {
    closing.current = true;
    // Stop listening, but keep the channel open briefly so the last answer's transcript lands.
    mic.current?.getTracks().forEach((t) => t.stop());
    const deadline = Date.now() + FLUSH_TIMEOUT_MS;
    while (pendingTranscripts.current.size && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150));
    }
    teardown();
    await Promise.allSettled([...pendingSaves.current]);
    if (alive.current) setStatus("ended");
  }, [teardown]);

  return useMemo(
    () => ({
      status,
      mode,
      currentQuestionIndex,
      totalQuestions: questions.length,
      isInterviewerSpeaking: status === "interviewer_speaking",
      isCandidateSpeaking: candidateSpeaking,
      captions,
      candidateCaption,
      transcript,
      error,
      muted,
      start,
      repeat,
      skip,
      toggleMute,
      sendText,
      end,
      getOutputLevel,
      getInputLevel,
    }),
    [
      status,
      mode,
      currentQuestionIndex,
      questions.length,
      candidateSpeaking,
      captions,
      candidateCaption,
      transcript,
      error,
      muted,
      start,
      repeat,
      skip,
      toggleMute,
      sendText,
      end,
      getOutputLevel,
      getInputLevel,
    ],
  );
}
