import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import * as searchController from "../controllers/search.controller";

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(searchController.globalSearch));

export { router as searchRoutes };
