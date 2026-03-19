import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { config } from "../../config/index";
import { BadRequestError } from "../../utils/AppError";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const UPLOAD_DIR = config.upload.uploadDir;
const MAX_SIZE = config.upload.maxFileSizeMb * 1024 * 1024;

// Ensure upload directory exists
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Extend Express Request to carry file info
declare global {
  namespace Express {
    interface Request {
      uploadedFile?: {
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        path: string;
        url: string;
      };
    }
  }
}

/**
 * Simple single-file upload middleware.
 * Accepts base64-encoded file in JSON body: { file: "data:mime;base64,...", filename: "receipt.pdf" }
 */
export function uploadFile(subDir = "general") {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const body = req.body;
    if (!body?.file || typeof body.file !== "string") {
      return next(); // No file in request, skip
    }

    // Parse data URI: data:image/png;base64,iVBOR...
    const match = body.file.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw BadRequestError("Invalid file format. Expected base64 data URI.");
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, "base64");

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw BadRequestError(`File type '${mimeType}' is not allowed.`);
    }

    if (buffer.length > MAX_SIZE) {
      throw BadRequestError(
        `File exceeds maximum size of ${config.upload.maxFileSizeMb}MB.`
      );
    }

    // Determine extension
    const ext =
      mimeType
        .split("/")[1]
        ?.replace("jpeg", "jpg")
        .replace(
          "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "xlsx"
        ) || "bin";
    const filename = `${uuid()}.${ext}`;
    const dir = path.join(UPLOAD_DIR, subDir);
    ensureDir(dir);

    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);

    const originalName = body.filename || `upload.${ext}`;

    req.uploadedFile = {
      filename,
      originalName,
      mimeType,
      size: buffer.length,
      path: filePath,
      url: `/uploads/${subDir}/${filename}`,
    };

    // Remove file data from body to avoid storing it in DB
    delete body.file;
    delete body.filename;

    next();
  };
}
