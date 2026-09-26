import type { NextFunction, Request, Response } from "express";

/** One line per request: method, path, status, duration. Never logs bodies or headers. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const user = req.auth?.userId ? ` user=${req.auth.userId}` : "";
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms${user}`);
  });
  next();
}
