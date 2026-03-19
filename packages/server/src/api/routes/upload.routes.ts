import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { uploadFile } from "../middleware/upload.middleware";
import type { Request, Response } from "express";

const router = Router();
router.use(authenticate);

// General file upload endpoint
router.post(
  "/",
  uploadFile("files"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.uploadedFile) {
      res.status(400).json({
        success: false,
        error: { code: "NO_FILE", message: "No file uploaded" },
      });
      return;
    }
    res.json({ success: true, data: req.uploadedFile });
  })
);

// Receipt upload (for expenses)
router.post(
  "/receipts",
  uploadFile("receipts"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.uploadedFile) {
      res.status(400).json({
        success: false,
        error: { code: "NO_FILE", message: "No file uploaded" },
      });
      return;
    }
    res.json({ success: true, data: req.uploadedFile });
  })
);

// Invoice attachment upload
router.post(
  "/attachments",
  uploadFile("attachments"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.uploadedFile) {
      res.status(400).json({
        success: false,
        error: { code: "NO_FILE", message: "No file uploaded" },
      });
      return;
    }
    res.json({ success: true, data: req.uploadedFile });
  })
);

export { router as uploadRoutes };
