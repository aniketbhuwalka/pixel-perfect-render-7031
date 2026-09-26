import cors from "cors";
import express from "express";
import { env } from "./lib/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { healthRouter } from "./routes/health.js";
import { realtimeRouter } from "./routes/realtime.js";
import { resumesRouter } from "./routes/resumes.js";
import { sessionsRouter } from "./routes/sessions.js";
import { turnsRouter } from "./routes/turns.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Railway's proxy

  app.use(requestLogger);
  app.use(
    cors({
      origin: env.ALLOWED_ORIGIN.split(",").map((o) => o.trim()),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(healthRouter);
  app.use(resumesRouter);
  app.use(sessionsRouter);
  app.use(realtimeRouter);
  app.use(turnsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
