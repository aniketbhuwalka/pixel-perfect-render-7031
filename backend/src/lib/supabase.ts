import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Server-side admin client. Uses the service role key, so it bypasses RLS —
 * always scope queries/writes to the authenticated userId yourself.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const RESUMES_BUCKET = "resumes";
