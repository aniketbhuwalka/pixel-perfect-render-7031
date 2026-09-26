# PrepPilot API

Standalone Express + TypeScript API for PrepPilot. It uses Supabase for auth, Postgres and storage, and deploys to Railway.

```
src/
  index.ts              # boots the server
  app.ts                # middleware + route wiring
  lib/                  # env (zod-validated), supabase admin client, HttpError
  middleware/           # auth (Supabase JWT), request logger, error handler
  routes/               # health, resumes
  services/             # text extraction, resume upload/insert
  prompts/              # LLM prompt templates (upcoming)
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill it in:

   | Var | Where to find it |
   |---|---|
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
   | `SUPABASE_JWT_SECRET` | *Optional.* Only needed if your project still signs tokens with the legacy HS256 secret (Supabase → Project Settings → JWT Keys). |
   | `OPENAI_API_KEY` | platform.openai.com/api-keys |
   | `ALLOWED_ORIGIN` | Frontend origin, e.g. `http://localhost:8080`. Comma-separate multiple origins. |
   | `PORT` | Optional locally (defaults to 4000). Railway sets it for you. |

   The server refuses to start if any variable is missing. It names the missing variables but never prints their values.

3. In Supabase → Storage, create a **private** bucket named `resumes`. The tables must already exist; see the frontend's `drizzle/migrations`.

## Run

```bash
npm run dev          # tsx watch, reloads on save
npm run build        # compile to dist/
npm start            # run compiled build (what Railway runs)
```

## Auth

Every `/api/*` route expects `Authorization: Bearer <supabase access token>`. Tokens are verified locally:
- **HS256 tokens** (legacy projects) are checked with `SUPABASE_JWT_SECRET`.
- **ES256/RS256 tokens** (projects using the newer JWT signing keys) are checked against the project's JWKS at `SUPABASE_URL/auth/v1/.well-known/jwks.json`.

Either way, the token's `sub` becomes `req.auth.userId`.

## Endpoints

### `GET /health` → `{ "ok": true }`

### `POST /api/resumes`
Send a multipart upload with a field named `file`. It must be `.pdf` or `.docx`, 5MB max, and the file's contents must match its extension.

| Status | Body |
|---|---|
| 201 | `{ resume_id, extracted_text, char_count }`. The original file is stored at `resumes/<userId>/<uuid>.<ext>`. |
| 400 | `missing_file` |
| 401 | `unauthorized` |
| 413 | `file_too_large` |
| 415 | `unsupported_file_type` |
| 422 | `unreadable_file`: less than 200 characters of text (e.g. a scanned PDF). Nothing is stored. |
| 500 | `internal_error`. Details are only logged server-side. |

### `POST /api/sessions`
Send a JSON body like this:

```json
{ "resume_id": "<uuid>", "role_title": "...", "jd_text": "<100+ chars>", "mode": "voice" }
```

The endpoint:
1. Loads the resume, checking it belongs to the caller. Another user's resume returns 404.
2. Makes one `gpt-4o-mini` call in JSON mode at temperature 0.4 (prompt in `src/prompts/questionPlan.ts`). This produces the gap map and exactly 5 questions: 2 behavioural, 2 role-specific and 1 gap-targeted, sorted easy → hard.
3. Validates the output with zod. On invalid JSON, a schema mismatch or an OpenAI error, it retries once at temperature 0. If that also fails, it uses a generic 5-question plan with an empty `gap_map` and logs `QUESTION PLAN FALLBACK USED`. Either way the user gets a session.
4. Inserts the session, then all questions in a single multi-row insert. If the questions insert fails, it deletes the session so no half-built session is left.

| Status | Body |
|---|---|
| 201 | `{ session_id, candidate_first_name, gap_map: [{requirement, status, evidence}], questions: [{id, text, type, difficulty, order_index, ...}] }` |
| 400 | `invalid_request` with per-field `issues` |
| 401 | `unauthorized` |
| 404 | `resume_not_found` |

### `GET /api/sessions`
Returns `{ sessions: [{ id, role_title, mode, status, started_at, duration_seconds, overall_score|null }] }` for the caller, newest first, capped at 100.

### `GET /api/sessions/:id`
Returns `{ session, questions, turns, report|null }`. This is everything the interview room, report and replay screens need. The `report` has the same shape as `POST /api/sessions/:id/report` returns. Returns `404` if the session isn't the caller's.

### `POST /api/realtime/token`
Send `{ "session_id": "<uuid>" }`. The session must belong to the caller and have status `in_progress`. The endpoint builds the interviewer instructions from the session's data (`src/prompts/interviewer.ts`), then mints a short-lived OpenAI Realtime client secret via `POST /v1/realtime/client_secrets`. The secret uses model `gpt-realtime-2.1`, voice `verse`, server VAD with 700ms of silence, and input transcription with `gpt-4o-mini-transcribe`. The secret expires after 120s, but a call that has already connected keeps running.

Rate limit: 10 requests per user per 10 minutes, kept in memory. Each mint is logged with the session id and user id.

| Status | Body |
|---|---|
| 200 | `{ client_secret: "ek_...", expires_at: ISO string, model }` |
| 400 / 401 | `invalid_request` / `unauthorized` |
| 404 | `session_not_found` |
| 409 | `session_not_active` (status isn't `in_progress`) |
| 429 | `rate_limited` |
| 503 | `realtime_unavailable`: OpenAI failed, so the frontend should fall back to text mode |

### `POST /api/turns`
Send a JSON body like this:

```json
{ "session_id": "<uuid>", "question_id": "<uuid>|null", "speaker": "interviewer|candidate", "text": "...", "is_followup": false, "started_at": "ISO?", "ended_at": "ISO?" }
```

This is the hot path during a live interview: ownership and question lookups run in parallel, then one insert. The first turn for a question stamps `questions.asked_at`. `started_at` and `ended_at` are optional, but without them the report can't compute speaking time or pace. Rate limit: 120 requests per user per minute. Returns `201 { ok: true, turn_id }`, `404 session_not_found`, `409 session_not_active` or `400 invalid_question`.

### `POST /api/sessions/:id/report`
No body. It's **idempotent**: if a report exists, it's returned as is with no OpenAI call. Simultaneous calls share a single generation.

1. Candidate turns are stitched into one answer per question. A turn without a `question_id` belongs to the last question asked. Word count and speaking seconds come from the turn timestamps.
2. Filler words, average words per answer and pace are **measured in code**. The model only judges `used_star_structure`.
3. One `gpt-4o-mini` call in JSON mode at temperature 0.3 (prompt in `src/prompts/report.ts`), validated with zod. On failure it retries at temperature 0.
4. If both attempts fail, or the candidate never spoke, it saves a **reduced report**: estimated scores only, empty lists, `reduced: true`.
5. It inserts the answers and feedback, then the `session_reports` row, then marks the session `completed` with `ended_at` and `duration_seconds`.

### Seeding a fake finished interview
```bash
npm run seed:fake -- you@example.com
```
This creates a resume, a session, 5 questions and a realistic 21-turn transcript with timestamps for that user. The session is left `in_progress` with no report yet, and the script prints the curl command to generate the report. Run it again for a fresh session.

## Testing with curl

Get an access token for a test user. This needs the project's **anon/publishable** key, not the service role key:

```bash
curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"your-password"}'
# copy "access_token" from the response
TOKEN=eyJ...
```

Then call the API:

```bash
curl http://localhost:4000/health

curl -X POST http://localhost:4000/api/resumes \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./my-resume.pdf"
```

Create a session with the `resume_id` returned above:

```bash
curl -X POST http://localhost:4000/api/sessions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"resume_id":"PASTE-RESUME-ID","role_title":"Senior Product Analyst","mode":"voice","jd_text":"You will own product analytics for our lending product: design and analyse A/B tests, define north-star metrics, build self-serve dashboards and partner with PMs. Requirements: 4+ years in product analytics, expert SQL, experimentation, Python."}'
```

In PowerShell, use `curl.exe` instead of `curl`.

## Deploy to Vercel

This folder lives in the frontend's repo and deploys as its own Vercel project. Vercel runs Express apps with zero configuration: it detects `src/index.ts` and runs the whole app as one Vercel Function.

1. In Vercel, click **Add New → Project**, import the repo, and set **Root Directory** to `backend`.
2. Add the env vars above under **Settings → Environment Variables**. Don't set `PORT`. Set `ALLOWED_ORIGIN` to the frontend's Vercel URL.
3. Every push to `main` redeploys automatically.

On Vercel, keep in mind:
- **Upload size:** Vercel caps request bodies at 4.5MB, so resumes between 4.5MB and 5MB are rejected before they reach the API.
- **Per-instance memory:** the rate limits and the "one report generation at a time" guard live in memory, so each function instance has its own. The limits are therefore looser under heavy traffic.
