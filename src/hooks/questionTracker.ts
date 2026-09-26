export const CLOSING_PHRASE = /interview is (now )?(complete|over|finished)/i;

const STOPWORDS = new Set(
  "about after again also been being could does from have into just like more most much only other over same some such than that their them then there these they this those very were what when where which while with would your you're".split(
    " ",
  ),
);

const contentWords = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );

/** Share of the question's content words that appear in what the interviewer said. */
export function overlap(said: string, question: string) {
  const q = contentWords(question);
  if (!q.size) return 0;
  const s = contentWords(said);
  let hit = 0;
  for (const w of q) if (s.has(w)) hit += 1;
  return hit / q.size;
}

export type Tag = { questionIndex: number; isFollowup: boolean };

/**
 * Works out which question an interviewer turn belongs to. The instructions make the model
 * open with a greeting, then ask each question followed by exactly one follow-up, so the
 * rhythm is greeting → question → follow-up → question… Text overlap overrides the rhythm
 * when the model re-asks or skips a follow-up.
 *
 * questionIndex is -1 during the greeting: those turns belong to no question.
 */
export class QuestionTracker {
  index = -1;
  expecting: "question" | "followup" = "question";
  candidateSpoke = false;
  repeatPending = false;
  interviewerTurns = 0;
  last: Tag = { questionIndex: -1, isFollowup: false };

  constructor(private questions: { text: string }[]) {}

  classify(text: string): Tag {
    const qs = this.questions;
    this.interviewerTurns += 1;
    if (this.repeatPending) {
      this.repeatPending = false;
      return (this.last = { questionIndex: this.index, isFollowup: false });
    }
    if (this.index === -1) {
      // Opening greeting. Introductions end at the first turn that asks question 1 — either
      // recognisably, or (after the greeting itself) any turn that asks something.
      const asksFirstQuestion =
        !qs[0] ||
        overlap(text, qs[0].text) >= 0.45 ||
        (this.interviewerTurns > 1 && text.includes("?"));
      if (!asksFirstQuestion) {
        this.candidateSpoke = false;
        return (this.last = { questionIndex: -1, isFollowup: false });
      }
    } else if (!this.candidateSpoke) {
      // The interviewer kept talking without the candidate answering: same context as before.
      return this.last;
    }
    this.candidateSpoke = false;

    if (CLOSING_PHRASE.test(text) && this.index >= qs.length - 1) {
      return (this.last = { questionIndex: this.index, isFollowup: false });
    }
    const next = this.index + 1;
    const matchesNext = next < qs.length && overlap(text, qs[next]!.text) >= 0.45;
    const matchesCurrent = this.index >= 0 && overlap(text, qs[this.index]!.text) >= 0.5;

    if (matchesNext || (this.expecting === "question" && next < qs.length)) {
      this.index = next;
      this.expecting = "followup";
      return (this.last = { questionIndex: next, isFollowup: false });
    }
    if (matchesCurrent) return (this.last = { questionIndex: this.index, isFollowup: false });
    this.expecting = "question";
    return (this.last = { questionIndex: this.index, isFollowup: this.index >= 0 });
  }

  skip() {
    this.expecting = "question";
    this.candidateSpoke = true;
  }
}
