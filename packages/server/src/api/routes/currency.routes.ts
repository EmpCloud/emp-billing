import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import * as currencyController from "../controllers/currency.controller";

const router = Router();

router.use(authenticate);

router.get("/rates", asyncHandler(currencyController.getExchangeRates));
router.post("/convert", asyncHandler(currencyController.convertAmount));
router.get("/currencies", asyncHandler(currencyController.getSupportedCurrencies));

export { router as currencyRoutes };
