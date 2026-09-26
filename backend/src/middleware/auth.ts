import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";
import { env } from "../lib/env.js";

const hsSecret = env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET) : null;
// Newer Supabase projects sign access tokens with asymmetric keys (ES256/RS256)
// instead of the legacy HS256 JWT secret. Support both so either project type works.
const jwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", env.SUPABASE_URL));

async function verify(token: string): Promise<JWTPayload> {
  const { alg } = decodeProtectedHeader(token);
  const opts = { audience: "authenticated" };
  if (alg === "HS256") {
    if (!hsSecret) throw new Error("HS256 token received but SUPABASE_JWT_SECRET is not set");
    return (await jwtVerify(token, hsSecret, opts)).payload;
  }
  return (await jwtVerify(token, jwks, opts)).payload;
}

function unauthorized(res: Response, message: string) {
  res.status(401).json({ error: "unauthorized", message });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return unauthorized(res, "Missing Bearer token");

  try {
    const payload = await verify(token);
    if (!payload.sub) return unauthorized(res, "Token has no subject");
    req.auth = { userId: payload.sub };
    next();
  } catch {
    unauthorized(res, "Invalid or expired token");
  }
}
