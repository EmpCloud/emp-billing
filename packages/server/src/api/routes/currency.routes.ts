import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import * as currencyController from "../controllers/currency.controller";

const router = Router();

router.use(authenticate);

// GET /api/v1/currency/rates?base=USD — get all rates for a base currency
router.get("/rates", asyncHandler(currencyController.getExchangeRates));

// GET /api/v1/currency/convert?from=USD&to=INR&amount=100 — convert amount
router.get("/convert", asyncHandler(currencyController.convertAmount));

// GET /api/v1/currency/rate?from=USD&to=INR — get single exchange rate
router.get("/rate", asyncHandler(currencyController.getRate));

// GET /api/v1/currency/currencies — list all supported currency codes
router.get("/currencies", asyncHandler(currencyController.getSupportedCurrencies));

export { router as currencyRoutes };
