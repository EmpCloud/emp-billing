"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = (0, express_1.Router)();
exports.uploadRoutes = router;
router.use(auth_middleware_1.authenticate);
// General file upload endpoint
router.post("/", (0, upload_middleware_1.uploadFile)("files"), (0, error_middleware_1.asyncHandler)(async (req, res) => {
    if (!req.uploadedFile) {
        res.status(400).json({
            success: false,
            error: { code: "NO_FILE", message: "No file uploaded" },
        });
        return;
    }
    res.json({ success: true, data: req.uploadedFile });
}));
// Receipt upload (for expenses)
router.post("/receipts", (0, upload_middleware_1.uploadFile)("receipts"), (0, error_middleware_1.asyncHandler)(async (req, res) => {
    if (!req.uploadedFile) {
        res.status(400).json({
            success: false,
            error: { code: "NO_FILE", message: "No file uploaded" },
        });
        return;
    }
    res.json({ success: true, data: req.uploadedFile });
}));
// Invoice attachment upload
router.post("/attachments", (0, upload_middleware_1.uploadFile)("attachments"), (0, error_middleware_1.asyncHandler)(async (req, res) => {
    if (!req.uploadedFile) {
        res.status(400).json({
            success: false,
            error: { code: "NO_FILE", message: "No file uploaded" },
        });
        return;
    }
    res.json({ success: true, data: req.uploadedFile });
}));
//# sourceMappingURL=upload.routes.js.map