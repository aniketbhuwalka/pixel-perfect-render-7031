import type { ApiReport } from "./api";

export type CoachDimension = {
  key: "clarity" | "confidence" | "articulation";
  label: string;
  /** what it's based on, in plain words */
  basis: string;
  /** 0–100, or null when there isn't enough data (e.g. no speaking times in text mode) */
  score: number | null;
  /** one sentence on what we saw, with the actual number */
  observation: string;
  /** one concrete thing to do in the next interview */
  tip: string;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.round(Math.min(hi, Math.max(lo, n)));
const IDEAL_PACE = { min: 130, max: 160 };
const IDEAL_WORDS = { min: 60, max: 180 };

/**
 * Turns the measured communication stats (filler words, pace, answer length, STAR use) into
 * three coachable dimensions. These are transparent rules of thumb, not a model's opinion —
 * each observation cites the number it came from.
 */
export function communicationCoach(report: ApiReport): CoachDimension[] {
  const c = report.communication;
  const answered = report.per_question.filter((q) => q.answer_text.trim()).length;
  const totalWords = c.avg_words_per_answer * answered;
  const fillerRate = totalWords ? (c.filler_word_count / totalWords) * 100 : 0; // per 100 words
  const pace = c.pace_wpm;
  const words = c.avg_words_per_answer;

  // Clarity: is the point easy to follow? Structure (STAR) plus answers of a digestible length.
  const structurePart = c.used_star_structure == null ? 45 : c.used_star_structure ? 60 : 30;
  const lengthPart =
    words === 0
      ? 0
      : words < IDEAL_WORDS.min
        ? 35 * (words / IDEAL_WORDS.min)
        : words > IDEAL_WORDS.max
          ? Math.max(5, 35 - (words - IDEAL_WORDS.max) / 6)
          : 35;
  const clarity: CoachDimension = {
    key: "clarity",
    label: "Clarity",
    basis: "Answer structure (STAR) and answer length",
    score: answered ? clamp(structurePart + lengthPart + 5) : null,
    observation: `${
      c.used_star_structure == null
        ? "Structure wasn't assessed"
        : c.used_star_structure
          ? "You mostly answered in STAR order"
          : "Your answers didn't follow a clear situation → action → result order"
    }, averaging ${words} words per answer.`,
    tip:
      c.used_star_structure === false
        ? "Lead with one line of situation, then what YOU did, then the result with a number."
        : words > IDEAL_WORDS.max
          ? `Trim to ${IDEAL_WORDS.min}–${IDEAL_WORDS.max} words: state the result first, then only the detail that proves it.`
          : words < IDEAL_WORDS.min
            ? "Add the specific situation and the outcome — short answers leave the interviewer guessing."
            : "Keep this shape; make sure every story ends on a measurable result.",
  };

  // Confidence: how sure you sound. Filler words are the biggest tell; rushing or dragging adds to it.
  let confidenceScore = 100 - Math.max(0, fillerRate - 1) * 12;
  if (pace != null && (pace > 175 || pace < 110)) confidenceScore -= 10;
  const confidence: CoachDimension = {
    key: "confidence",
    label: "Confidence",
    basis: "Filler words per 100 words, and whether you rushed",
    score: answered ? clamp(confidenceScore, 25) : null,
    observation: `${c.filler_word_count} filler word${c.filler_word_count === 1 ? "" : "s"} (“um”, “you know”…) — about ${fillerRate.toFixed(1)} per 100 words.`,
    tip:
      fillerRate > 2
        ? "When you need a second to think, pause silently instead of saying “um” — silence reads as composure."
        : pace != null && pace > 175
          ? "You sound sure but hurried — take a breath before each answer."
          : "Filler words are under control. Keep ending answers firmly instead of trailing off.",
  };

  // Articulation: how easy you are to hear and follow — speaking pace, with heavy filler as a drag.
  const offPace =
    pace == null
      ? 0
      : pace < IDEAL_PACE.min
        ? IDEAL_PACE.min - pace
        : pace > IDEAL_PACE.max
          ? pace - IDEAL_PACE.max
          : 0;
  const articulation: CoachDimension = {
    key: "articulation",
    label: "Articulation",
    basis: "Speaking pace (130–160 wpm is easiest to follow)",
    score: pace == null ? null : clamp(95 - offPace * 1.5 - (fillerRate > 3 ? 10 : 0), 30),
    observation:
      pace == null
        ? "Pace isn't measured for typed answers."
        : `You spoke at ${pace} words per minute${
            pace > IDEAL_PACE.max
              ? " — faster than is easy to follow"
              : pace < IDEAL_PACE.min
                ? " — a little slow"
                : " — a comfortable pace"
          }.`,
    tip:
      pace == null
        ? "Try a voice interview to get feedback on how you sound."
        : pace > IDEAL_PACE.max
          ? "Slow down on the numbers and names — they're what the interviewer needs to catch."
          : pace < IDEAL_PACE.min
            ? "Pick up the pace slightly; prepare your first sentence so you start strong."
            : "Your pace works. Emphasise the result in each answer so it stands out.",
  };

  return [clarity, confidence, articulation];
}

/** The weakest measured dimension: where to focus first. */
export function focusArea(dimensions: CoachDimension[]): CoachDimension | null {
  const scored = dimensions.filter((d) => d.score != null);
  return scored.length ? scored.reduce((a, b) => (b.score! < a.score! ? b : a)) : null;
}
