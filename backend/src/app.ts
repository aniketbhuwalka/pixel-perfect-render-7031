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
  app.set("trust proxy", 1); // behind Vercel's proxy

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

// Vercel's Express support looks for src/app.ts before src/index.ts and runs its default
// export as the function, so the app itself must be exported here. Locally, src/index.ts
// imports it and starts a server.
const app = createApp();
export default app;
