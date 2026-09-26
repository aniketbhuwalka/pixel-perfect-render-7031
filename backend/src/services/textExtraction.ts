import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export type ResumeKind = "pdf" | "docx";

/** Detect the real file type from its first bytes, not just the name the client sent. */
export function sniffKind(buf: Buffer): ResumeKind | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  // DOCX is a ZIP container: "PK\x03\x04"
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "docx";
  return null;
}

export async function extractText(buf: Buffer, kind: ResumeKind): Promise<string> {
  const raw = kind === "pdf" ? await extractPdf(buf) : (await mammoth.extractRawText({ buffer: buf })).value;
  return normalize(raw);
}

async function extractPdf(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

/** Collapse runs of spaces and blank lines, and drop pdf-parse's page separators. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/^-- \d+ of \d+ --$/gm, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
