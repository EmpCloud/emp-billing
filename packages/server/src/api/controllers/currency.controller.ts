import type { Request, Response } from "express";
import * as exchangeService from "../../services/currency/exchange-rate.service";
import { BadRequestError } from "../../utils/AppError";

export async function getExchangeRates(req: Request, res: Response): Promise<void> {
  const base = (req.query.base as string) || "USD";
  const rates = await exchangeService.getExchangeRates(base);
  res.json({ success: true, data: { base: base.toUpperCase(), rates } });
}

export async function convertAmount(req: Request, res: Response): Promise<void> {
  const from = req.query.from as string;
  const to = req.query.to as string;
  const amountStr = req.query.amount as string;

  if (!from || !to || !amountStr) {
    throw BadRequestError("Query parameters 'from', 'to', and 'amount' are required");
  }

  const amount = Number(amountStr);
  if (isNaN(amount) || amount < 0) {
    throw BadRequestError("'amount' must be a non-negative number");
  }

  const rate = await exchangeService.getRate(from, to);
  const converted = await exchangeService.convertAmount(amount, from, to);

  res.json({
    success: true,
    data: {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      amount,
      rate,
      converted,
    },
  });
}

export async function getRate(req: Request, res: Response): Promise<void> {
  const from = req.query.from as string;
  const to = req.query.to as string;

  if (!from || !to) {
    throw BadRequestError("Query parameters 'from' and 'to' are required");
  }

  const rate = await exchangeService.getRate(from, to);

  res.json({
    success: true,
    data: {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate,
    },
  });
}

export async function getSupportedCurrencies(_req: Request, res: Response): Promise<void> {
  const currencies = await exchangeService.getSupportedCurrencies();
  res.json({ success: true, data: currencies });
}
