import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Mic, MicOff, Loader2 } from "lucide-react";
import { GapMapCard } from "@/components/GapMapCard";
import { ResumeReadinessCard } from "@/components/ResumeReadinessCard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/preflight/$sessionId")({
  head: () => ({
    meta: [
      { title: "Microphone check — PrepPilot" },
      { name: "description", content: "Check your microphone before the spoken interview begins." },
      { property: "og:title", content: "Microphone check — PrepPilot" },
      { property: "og:description", content: "Test your mic and input level before you begin." },
    ],
  }),
  component: Preflight,
});

type PermissionState = "idle" | "requesting" | "granted" | "denied";

function Preflight() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [permission, setPermission] = useState<PermissionState>("idle");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [level, setLevel] = useState(0);
  const [heardYou, setHeardYou] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const { data } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.getSession(sessionId),
  });
  const toTextMode = () =>
    navigate({ to: "/interview/$sessionId", params: { sessionId }, search: { mode: "text" } });

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void ctxRef.current?.close();
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const requestMic = useCallback(
    async (preferredId?: string) => {
      setPermission("requesting");
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: preferredId ? { deviceId: { exact: preferredId } } : true,
        });
        streamRef.current = stream;
        setPermission("granted");

        const all = await navigator.mediaDevices.enumerateDevices();
        const inputs = all.filter((d) => d.kind === "audioinput");
        setDevices(inputs);
        if (!preferredId && inputs[0]) setDeviceId(inputs[0].deviceId);

        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (const v of buffer) sum += (v - 128) ** 2;
          const rms = Math.sqrt(sum / buffer.length) / 128;
          const next = Math.min(1, rms * 4);
          setLevel(next);
          if (next > 0.12) setHeardYou(true);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setPermission("denied");
      }
    },
    [stop],
  );

  if (permission === "denied") {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <MicOff className="size-6" />
        </span>
        <h1 className="mt-6 text-2xl font-semibold">We can't hear your microphone</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your browser blocked microphone access. You can allow it in the address bar and try again
          — or do this interview by typing instead. Nothing is lost either way.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => void requestMic()}>Try the microphone again</Button>
          <Button variant="outline" onClick={toTextMode}>
            Continue in text mode instead
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <h1 className="text-3xl font-semibold">Sound check</h1>
      <p className="mt-2 text-muted-foreground">One minute here saves a broken interview later.</p>

      <section className="surface mt-8 space-y-6 p-6">
        {permission !== "granted" ? (
          <div className="text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Mic className="size-6" />
            </span>
            <p className="mt-4 text-sm text-muted-foreground">
              PrepPilot needs your microphone to hear your answers.
            </p>
            <Button
              className="mt-5"
              disabled={permission === "requesting"}
              onClick={() => void requestMic()}
            >
              {permission === "requesting" ? <Loader2 className="size-4 animate-spin" /> : null}
              {permission === "requesting" ? "Waiting for permission…" : "Allow microphone"}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Input device</Label>
              <Select
                value={deviceId}
                onValueChange={(value) => {
                  setDeviceId(value);
                  void requestMic(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a microphone" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d, i) => (
                    <SelectItem key={d.deviceId || i} value={d.deviceId || `device-${i}`}>
                      {d.label || `Microphone ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Input level</Label>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-75"
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
            </div>

            <div
              className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
                heardYou ? "border-success/40 bg-success/10" : "border-border bg-muted/40"
              }`}
            >
              {heardYou ? (
                <CheckCircle2 className="size-5 text-success" />
              ) : (
                <Mic className="size-5 text-muted-foreground" />
              )}
              <span>
                {heardYou
                  ? "Heard you loud and clear. You're ready."
                  : "Say hello so we can check the level."}
              </span>
            </div>
          </>
        )}
      </section>

      <div className="mt-7 flex items-center gap-4">
        <Button
          size="lg"
          disabled={permission !== "granted" || !heardYou}
          onClick={() => {
            stop();
            navigate({ to: "/interview/$sessionId", params: { sessionId } });
          }}
        >
          Begin
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            stop();
            toTextMode();
          }}
        >
          Skip and use text mode
        </button>
      </div>

      {data?.session.gap_map.length ? (
        <div className="mt-12">
          <GapMapCard
            gapMap={data.session.gap_map}
            title="What your interviewer will probe"
            description={`We compared your resume with the ${data.session.role_title} job description. Expect questions on anything marked missing.`}
          />
        </div>
      ) : null}

      {data?.session.resume_readiness ? (
        <div className="mt-5">
          <ResumeReadinessCard readiness={data.session.resume_readiness} />
        </div>
      ) : null}
    </main>
  );
}
