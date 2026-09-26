import { useEffect, useRef } from "react";

/** Matches INTERVIEWER_NAME in the API's interviewer prompt, which introduces itself by this name. */
export const INTERVIEWER_NAME = "Alex";

// Cool, low-saturation palette that sits next to the teal accent rather than competing with it.
const SKIN = "#D2AD97";
const SKIN_SHADE = "#B08D7A";
const HAIR = "#25282C";
const HAIR_GREY = "#7C848C";
const BLAZER = "#1F3A40";
const LAPEL = "#172E33";
const SHIRT = "#E6ECEC";
const LIP = "#6B3B39";

/**
 * A calm hiring manager in his late 30s, illustrated in a flat style. His mouth follows the
 * real loudness of the interviewer's voice,
 * who blinks, and who nods along while the candidate talks. Animation runs in its own
 * requestAnimationFrame loop and writes SVG attributes directly, so React doesn't re-render
 * 60 times a second.
 */
export function InterviewerAvatar({
  getSpeakingLevel,
  getListeningLevel,
  speaking,
  listening,
  dimmed = false,
  className = "",
}: {
  getSpeakingLevel: () => number;
  getListeningLevel: () => number;
  speaking: boolean;
  listening: boolean;
  dimmed?: boolean;
  className?: string;
}) {
  const mouthOpen = useRef<SVGEllipseElement>(null);
  const mouthRest = useRef<SVGPathElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const brows = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const halo = useRef<SVGCircleElement>(null);
  const state = useRef({ speaking, listening });
  state.current = { speaking, listening };

  useEffect(() => {
    let raf = 0;
    let open = 0;
    let listen = 0;
    let nextBlink = performance.now() + 2500;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const frame = (now: number) => {
      const { speaking: isSpeaking, listening: isListening } = state.current;
      // Ease towards the live level so the mouth moves like speech, not like a meter.
      const target = isSpeaking ? getSpeakingLevel() : 0;
      open += (target - open) * (target > open ? 0.55 : 0.25);
      listen += ((isListening ? getListeningLevel() : 0) - listen) * 0.2;

      mouthOpen.current?.setAttribute("ry", (0.6 + open * 9).toFixed(2));
      mouthOpen.current?.setAttribute("rx", (7.5 + open * 2.5).toFixed(2));
      mouthRest.current?.setAttribute("opacity", Math.max(0, 1 - open * 5).toFixed(2));

      // Blink every few seconds (~140ms).
      let lid = 1;
      if (now >= nextBlink) {
        const t = now - nextBlink;
        lid = t < 140 ? Math.abs(t - 70) / 70 : 1;
        if (t >= 140) nextBlink = now + 2200 + Math.random() * 3500;
      }
      eyes.current?.setAttribute(
        "transform",
        `translate(0 112) scale(1 ${Math.max(lid, 0.08).toFixed(2)}) translate(0 -112)`,
      );

      if (!reduceMotion) {
        // Attentive nod while listening, a little lively tilt while speaking.
        const nod = isListening ? Math.sin(now / 420) * 1.4 + listen * 2 : 0;
        const tilt = isSpeaking
          ? Math.sin(now / 650) * 1.5 + open * 1.5
          : Math.sin(now / 2400) * 0.6;
        head.current?.setAttribute(
          "transform",
          `translate(0 ${nod.toFixed(2)}) rotate(${tilt.toFixed(2)} 120 150)`,
        );
        brows.current?.setAttribute(
          "transform",
          `translate(0 ${(-listen * 3 - open * 1.5).toFixed(2)})`,
        );
      }
      halo.current?.setAttribute("r", (104 + listen * 10 + open * 4).toFixed(2));
      halo.current?.setAttribute("opacity", (0.25 + listen * 0.5 + open * 0.3).toFixed(2));

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getSpeakingLevel, getListeningLevel]);

  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label={`${INTERVIEWER_NAME}, your interviewer${speaking ? ", speaking" : listening ? ", listening" : ""}`}
      className={`${className} transition-opacity duration-300 ${dimmed ? "opacity-40" : ""}`}
    >
      <defs>
        <clipPath id="avatar-clip">
          <circle cx="120" cy="120" r="100" />
        </clipPath>
      </defs>

      <circle
        ref={halo}
        cx="120"
        cy="120"
        r="104"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="3"
        opacity="0.25"
      />
      {/* flat backdrop: a quiet tint of the accent */}
      <circle cx="120" cy="120" r="100" fill="var(--color-primary)" fillOpacity="0.16" />

      <g clipPath="url(#avatar-clip)">
        {/* shoulders, shirt, lapels, tie */}
        <path d="M30 250 C30 196 70 176 120 176 C170 176 210 196 210 250 Z" fill={BLAZER} />
        <path d="M101 177 L120 212 L139 177 Z" fill={SHIRT} />
        <path d="M101 177 L112 222 L90 190 Z" fill={LAPEL} />
        <path d="M139 177 L128 222 L150 190 Z" fill={LAPEL} />
        <path
          d="M116.5 186 L123.5 186 L125.5 214 L120 221 L114.5 214 Z"
          fill="var(--color-primary)"
          fillOpacity="0.85"
        />
        {/* neck */}
        <rect x="106" y="146" width="28" height="36" rx="11" fill={SKIN_SHADE} />

        <g ref={head}>
          <ellipse cx="78" cy="118" rx="7.5" ry="11.5" fill={SKIN_SHADE} />
          <ellipse cx="162" cy="118" rx="7.5" ry="11.5" fill={SKIN_SHADE} />
          <ellipse cx="120" cy="113" rx="42" ry="52" fill={SKIN} />
          {/* jaw shadow: a trace of stubble */}
          <path
            d="M83 126 C87 152 103 165 120 165 C137 165 153 152 157 126 C151 146 137 157 120 157 C103 157 89 146 83 126 Z"
            fill={HAIR}
            opacity="0.1"
          />
          {/* short, neat hair with grey at the temples */}
          <path
            d="M77 104 C72 68 96 52 121 52 C149 52 169 69 164 104 C161 90 153 81 141 78 C127 84 104 86 86 82 C82 88 79 95 77 104 Z"
            fill={HAIR}
          />
          <path
            d="M78.5 103 C77.5 96 79 90 82.5 86"
            stroke={HAIR_GREY}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M162.5 103 C163.5 96 162 90 158.5 86"
            stroke={HAIR_GREY}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          {/* level brows sitting low over the eyes: attentive, not surprised */}
          <g ref={brows}>
            <rect x="94" y="99" width="19" height="4" rx="1.5" fill={HAIR} />
            <rect x="127" y="99" width="19" height="4" rx="1.5" fill={HAIR} />
          </g>
          <g ref={eyes}>
            <ellipse cx="104" cy="112" rx="4.2" ry="4.6" fill="#1F2326" />
            <ellipse cx="136" cy="112" rx="4.2" ry="4.6" fill="#1F2326" />
            <circle cx="105.3" cy="110.6" r="1.1" fill="#fff" opacity="0.9" />
            <circle cx="137.3" cy="110.6" r="1.1" fill="#fff" opacity="0.9" />
          </g>
          {/* faint under-eye lines */}
          <path
            d="M99 119.5 Q104 121.5 109 119.5"
            stroke={SKIN_SHADE}
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path
            d="M131 119.5 Q136 121.5 141 119.5"
            stroke={SKIN_SHADE}
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path
            d="M120 116 Q115.5 128 121.5 130"
            stroke={SKIN_SHADE}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
          {/* mouth: a level, closed resting line that gives way to an open mouth while speaking */}
          <ellipse ref={mouthOpen} cx="120" cy="143" rx="7.5" ry="0.6" fill={LIP} />
          <path
            ref={mouthRest}
            d="M110 142.5 Q120 143.5 130 142.5"
            stroke={LIP}
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
