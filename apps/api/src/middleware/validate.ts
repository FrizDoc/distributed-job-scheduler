import { NextFunction, Request, Response } from "express";
import { z } from "zod";

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

// req.query is read-only in express 5
export const validate =
  (schemas: Schemas) => (req: Request, res: Response, next: NextFunction) => {
    const validated: Record<string, unknown> = {};

    for (const key of ["params", "query", "body"] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          location: key,
          details: z.flattenError(result.error),
        });
      }
      validated[key] = result.data;
    }

    res.locals.validated = validated;
    next();
  };
