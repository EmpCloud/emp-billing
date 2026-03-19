import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

// Validate req.body against a Zod schema — throws ZodError on failure
// which is caught by errorMiddleware and returns a 422 response.
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

// Validate req.query
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as typeof req.query;
    next();
  };
}

// Validate req.params
export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.params = schema.parse(req.params) as typeof req.params;
    next();
  };
}
