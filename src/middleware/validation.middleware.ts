import type { NextFunction, Request, Response } from "express";
import * as z from "zod";
import { AppError } from "../errors/app-error.js";

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(400, "VALIDATION_ERROR", "Request body validation failed.", {
          fields: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        }),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}
