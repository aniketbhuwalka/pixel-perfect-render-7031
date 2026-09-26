import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { saveTurn } from "../services/turnService.js";

const turnBody = z
  .object({
    session_id: z.uuid(),
    question_id: z.uuid().nullable().default(null),
    speaker: z.enum(["interviewer", "candidate"]),
    text: z.string().trim().min(1).max(10_000),
    is_followup: z.boolean().default(false),
    // Optional but recommended: lets the report compute real speaking time and pace.
    started_at: z.iso.datetime({ offset: true }).optional(),
    ended_at: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((b) => !b.started_at || !b.ended_at || Date.parse(b.ended_at) >= Date.parse(b.started_at), {
    message: "ended_at must not be before started_at",
    path: ["ended_at"],
  });

// Generous: a lively interview produces a few turns a minute; this only stops runaway loops.
const turnLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.auth!.userId,
  handler: (_req, res) => {
    res.status(429).json({ error: "rate_limited", message: "Too many requests. Please slow down." });
  },
});

export const turnsRouter = Router();

turnsRouter.post("/api/turns", requireAuth, turnLimiter, async (req, res) => {
  const body = turnBody.parse(req.body ?? {});
  const result = await saveTurn({
    userId: req.auth!.userId,
    sessionId: body.session_id,
    questionId: body.question_id,
    speaker: body.speaker,
    text: body.text,
    isFollowup: body.is_followup,
    startedAt: body.started_at,
    endedAt: body.ended_at,
  });
  res.status(201).json(result);
});
