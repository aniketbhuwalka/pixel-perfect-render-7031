import { randomUUID } from "node:crypto";
import { HttpError } from "../lib/errors.js";
import { RESUMES_BUCKET, supabaseAdmin } from "../lib/supabase.js";
import { extractText, type ResumeKind } from "./textExtraction.js";

export const MIN_RESUME_CHARS = 200;

const CONTENT_TYPES: Record<ResumeKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type UploadInput = { userId: string; buffer: Buffer; kind: ResumeKind };

export async function createResume({ userId, buffer, kind }: UploadInput) {
  let text: string;
  try {
    text = await extractText(buffer, kind);
  } catch (err) {
    console.warn(`Text extraction failed for ${kind} upload:`, err);
    text = "";
  }

  // Too little text usually means a scanned image. Don't store anything.
  if (text.length < MIN_RESUME_CHARS) {
    throw new HttpError(
      422,
      "unreadable_file",
      "We couldn't read this file — it may be a scanned image. Please paste your resume text instead.",
    );
  }

  const path = `${userId}/${randomUUID()}.${kind}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(RESUMES_BUCKET)
    .upload(path, buffer, { contentType: CONTENT_TYPES[kind], upsert: false });
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data, error: insertError } = await supabaseAdmin
    .from("resumes")
    .insert({ user_id: userId, file_url: path, extracted_text: text })
    .select("id")
    .single();

  if (insertError || !data) {
    // Don't leave an orphaned file behind if the row insert fails.
    await supabaseAdmin.storage.from(RESUMES_BUCKET).remove([path]);
    throw new Error(`Resume insert failed: ${insertError?.message ?? "no row returned"}`);
  }

  return { resume_id: data.id as string, extracted_text: text, char_count: text.length };
}
