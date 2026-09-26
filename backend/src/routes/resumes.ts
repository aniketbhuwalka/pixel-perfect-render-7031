import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { HttpError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { createResume } from "../services/resumeService.js";
import { sniffKind, type ResumeKind } from "../services/textExtraction.js";

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, ResumeKind> = { ".pdf": "pdf", ".docx": "docx" };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXTENSIONS[ext]) return cb(null, true);
    cb(new HttpError(415, "unsupported_file_type", "Only .pdf and .docx files are supported."));
  },
});

export const resumesRouter = Router();

resumesRouter.post("/api/resumes", requireAuth, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, "missing_file", 'Attach the resume as a multipart field named "file".');

  const kind = EXTENSIONS[path.extname(file.originalname).toLowerCase()];
  // The extension passed the filter; make sure the bytes actually match it.
  if (!kind || sniffKind(file.buffer) !== kind) {
    throw new HttpError(415, "unsupported_file_type", "File contents don't match a valid .pdf or .docx.");
  }

  const result = await createResume({ userId: req.auth!.userId, buffer: file.buffer, kind });
  res.status(201).json(result);
});
