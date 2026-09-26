import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors.js";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "not_found", message: "Route not found" });
}

/** Central error handler: logs the full error server-side, sends only a safe message to the client. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "invalid_request",
      message: "Request validation failed",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({
      error: tooBig ? "file_too_large" : "invalid_upload",
      message: tooBig ? "File must be 5MB or smaller." : err.message,
    });
  }
  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "invalid_json", message: "Request body is not valid JSON" });
  }

  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: "internal_error", message: "Something went wrong. Please try again." });
}
