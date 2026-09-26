import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { mintRealtimeToken } from "../services/realtimeService.js";

const tokenBody = z.object({ session_id: z.uuid() });

// Per user (not per IP): enough for reconnects and retries, not for farming tokens.
// In-memory, so limits reset on restart and are per-instance — fine for a single Railway instance.
const tokenLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.auth!.userId,
  handler: (req, res) => {
    console.warn(`Realtime token rate limit hit user=${req.auth?.userId}`);
    res.status(429).json({ error: "rate_limited", message: "Too many voice session requests. Please wait a few minutes." });
  },
});

export const realtimeRouter = Router();

realtimeRouter.post("/api/realtime/token", requireAuth, tokenLimiter, async (req, res) => {
  const { session_id } = tokenBody.parse(req.body ?? {});
  res.json(await mintRealtimeToken(req.auth!.userId, session_id));
});
