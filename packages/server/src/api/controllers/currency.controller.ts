import type { Request, Response } from "express";
import * as exchangeService from "../../services/currency/exchange-rate.service";

export async function getExchangeRates(req: Request, res: Response): Promise<void> {
  const base = (req.query.base as string) || "USD";
  const rates = await exchangeService.getExchangeRates(base);
  res.json({ success: true, data: { base, rates } });
}

export async function convertAmount(req: Request, res: Response): Promise<void> {
  const { amount, from, to } = req.body;
  const result = await exchangeService.convertAmount(Number(amount), from, to);
  res.json({ success: true, data: { amount, from, to, result } });
}

export async function getSupportedCurrencies(req: Request, res: Response): Promise<void> {
  const currencies = await exchangeService.getSupportedCurrencies();
  res.json({ success: true, data: currencies });
}
