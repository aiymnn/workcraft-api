import type { ErrorRequestHandler } from "express";
import { AppError } from "./app-error.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: "error",
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
  }

  console.error("Unhandled error:", error);

  return res.status(500).json({
    status: "error",
    code: "INTERNAL_ERROR",
    message: "Internal server error.",
  });
};
