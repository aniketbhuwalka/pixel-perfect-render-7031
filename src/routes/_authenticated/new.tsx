import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileText, Loader2, Mic, Type, UploadCloud, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type InterviewMode } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({
    meta: [
      { title: "New interview — PrepPilot" },
      {
        name: "description",
        content: "Upload your resume and paste the job description to set up a spoken interview.",
      },
      { property: "og:title", content: "New interview — PrepPilot" },
      {
        property: "og:description",
        content: "Set up a spoken practice interview from your resume and a job description.",
      },
    ],
  }),
  component: NewSession,
});

const MAX_BYTES = 5 * 1024 * 1024;
// Matches the API: shorter job descriptions don't give the question planner enough to work with.
const MIN_JD_CHARS = 100;

function NewSession() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [resume, setResume] = useState<{
    id: string;
    name: string;
    chars: number;
  } | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [jd, setJd] = useState("");
  const [mode, setMode] = useState<InterviewMode>("voice");
  const [starting, setStarting] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const ok = /\.(pdf|docx)$/i.test(file.name);
    if (!ok) {
      toast.error("Please upload a PDF or DOCX file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That file is over 5MB. Try a smaller export.");
      return;
    }
    setParsing(true);
    setResume(null);
    try {
      const res = await api.uploadResume(file);
      setResume({ id: res.resume_id, name: file.name, chars: res.char_count });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't read that resume.");
    } finally {
      setParsing(false);
    }
  }

  async function handleStart() {
    if (!resume || !roleTitle.trim() || jd.trim().length < MIN_JD_CHARS) return;
    setStarting(true);
    try {
      const res = await api.createSession({
        resume_id: resume.id,
        role_title: roleTitle.trim(),
        jd_text: jd.trim(),
        mode,
      });
      navigate({
        to: mode === "voice" ? "/preflight/$sessionId" : "/interview/$sessionId",
        params: { sessionId: res.session_id },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't prepare your interviewer.");
      setStarting(false);
    }
  }

  const canStart =
    !!resume && roleTitle.trim().length > 1 && jd.trim().length >= MIN_JD_CHARS && !starting;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold">Set up your interview</h1>
      <p className="mt-2 text-muted-foreground">
        Two things and you're in the room: your resume, and the job you're aiming at.
      </p>

      <section className="surface mt-8 p-6">
        <Label className="text-sm font-medium">Your resume</Label>
        {parsing ? (
          <div className="mt-3 rounded-xl border border-border bg-muted/40 p-6">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin" /> Reading your resume…
            </p>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ) : resume ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-4">
            <CheckCircle2 className="size-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{resume.name}</p>
              <p className="text-xs text-muted-foreground">
                Parsed — {resume.chars.toLocaleString()} characters of text read
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setResume(null)}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center transition-colors ${
              dragging
                ? "border-primary bg-accent/50"
                : "border-border bg-muted/30 hover:bg-muted/60"
            }`}
          >
            <UploadCloud className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">Drop your resume here, or click to choose</span>
            <span className="text-xs text-muted-foreground">PDF or DOCX, up to 5MB</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
        />
      </section>

      <section className="surface mt-5 space-y-5 p-6">
        <div className="space-y-2">
          <Label htmlFor="role">Role title</Label>
          <Input
            id="role"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="Senior Product Analyst"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <Label htmlFor="jd">Job description</Label>
            <span className="text-xs text-muted-foreground">
              {jd.length.toLocaleString()} characters
              {jd.trim().length > 0 && jd.trim().length < MIN_JD_CHARS
                ? ` — at least ${MIN_JD_CHARS} needed`
                : ""}
            </span>
          </div>
          <Textarea
            id="jd"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description here…"
            className="min-h-56 resize-y"
          />
        </div>
      </section>

      <section className="surface mt-5 p-6">
        <Label className="text-sm font-medium">Interview mode</Label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            {
              value: "voice" as const,
              icon: Mic,
              title: "Voice",
              body: "The interviewer speaks and listens. Closest to the real thing.",
            },
            {
              value: "text" as const,
              icon: Type,
              title: "Text",
              body: "Type your answers. Good for a quiet room or a shaky mic.",
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                mode === option.value
                  ? "border-primary bg-accent/60"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <option.icon className="size-4" /> {option.title}
                {option.value === "voice" ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Default
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{option.body}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-7 flex items-center gap-4">
        <Button size="lg" disabled={!canStart} onClick={handleStart}>
          {starting ? <Loader2 className="size-4 animate-spin" /> : null}
          {starting ? "Preparing your interviewer…" : "Start interview"}
        </Button>
        {!resume ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4" /> Upload a resume to continue
          </p>
        ) : null}
      </div>
    </main>
  );
}
