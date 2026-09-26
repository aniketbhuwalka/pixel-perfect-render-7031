import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { createOrGetReport } from "../services/reportService.js";
import { getSessionDetail, listSessions } from "../services/sessionQueries.js";
import { createSession } from "../services/sessionService.js";

const createSessionBody = z.object({
  resume_id: z.uuid(),
  role_title: z.string().trim().min(1).max(200),
  jd_text: z.string().trim().min(100, "jd_text must be at least 100 characters").max(20_000),
  mode: z.enum(["voice", "text"]),
});

export const sessionsRouter = Router();

sessionsRouter.post("/api/sessions", requireAuth, async (req, res) => {
  const body = createSessionBody.parse(req.body ?? {});
  const result = await createSession({
    userId: req.auth!.userId,
    resumeId: body.resume_id,
    roleTitle: body.role_title,
    jdText: body.jd_text,
    mode: body.mode,
  });
  res.status(201).json(result);
});

sessionsRouter.get("/api/sessions", requireAuth, async (req, res) => {
  res.json(await listSessions(req.auth!.userId));
});

sessionsRouter.get("/api/sessions/:id", requireAuth, async (req, res) => {
  const sessionId = z.uuid().parse(req.params.id);
  res.json(await getSessionDetail(req.auth!.userId, sessionId));
});

// Idempotent: returns the stored report if one exists, otherwise generates it once.
sessionsRouter.post("/api/sessions/:id/report", requireAuth, async (req, res) => {
  const sessionId = z.uuid().parse(req.params.id);
  res.json(await createOrGetReport(req.auth!.userId, sessionId));
});
