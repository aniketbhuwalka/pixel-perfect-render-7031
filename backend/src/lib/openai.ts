import OpenAI from "openai";
import { env } from "./env.js";

// Retries are handled explicitly by callers (see services/questionPlan.ts), so the SDK's are off.
export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 0 });
