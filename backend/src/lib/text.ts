export function wordCount(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

// Only unambiguous fillers. "like"/"so"/"right" are too often real words to count reliably.
const FILLER_PATTERN =
  /\b(u+m+|u+h+|e+r+m*|a+h+|h+m+|you know|i mean|sort of|kind of|basically|literally)\b/gi;

export function fillerWordCount(text: string): number {
  return text.match(FILLER_PATTERN)?.length ?? 0;
}
