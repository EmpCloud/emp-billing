"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const index_1 = require("../../config/index");
const AppError_1 = require("../../utils/AppError");
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const UPLOAD_DIR = index_1.config.upload.uploadDir;
const MAX_SIZE = index_1.config.upload.maxFileSizeMb * 1024 * 1024;
// Ensure upload directory exists
function ensureDir(dir) {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
/**
 * Simple single-file upload middleware.
 * Accepts base64-encoded file in JSON body: { file: "data:mime;base64,...", filename: "receipt.pdf" }
 */
function uploadFile(subDir = "general") {
    return async (req, _res, next) => {
        const body = req.body;
        if (!body?.file || typeof body.file !== "string") {
            return next(); // No file in request, skip
        }
        // Parse data URI: data:image/png;base64,iVBOR...
        const match = body.file.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
            throw (0, AppError_1.BadRequestError)("Invalid file format. Expected base64 data URI.");
        }
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, "base64");
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            throw (0, AppError_1.BadRequestError)(`File type '${mimeType}' is not allowed.`);
        }
        if (buffer.length > MAX_SIZE) {
            throw (0, AppError_1.BadRequestError)(`File exceeds maximum size of ${index_1.config.upload.maxFileSizeMb}MB.`);
        }
        // Determine extension
        const ext = mimeType
            .split("/")[1]
            ?.replace("jpeg", "jpg")
            .replace("vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx") || "bin";
        const filename = `${(0, uuid_1.v4)()}.${ext}`;
        const dir = path_1.default.join(UPLOAD_DIR, subDir);
        ensureDir(dir);
        const filePath = path_1.default.join(dir, filename);
        fs_1.default.writeFileSync(filePath, buffer);
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
//# sourceMappingURL=upload.middleware.js.map