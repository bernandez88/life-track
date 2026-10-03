import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "./errors";

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof AppError) {
    return c.json({ error: error.code, message: error.message, details: error.details }, error.status as ContentfulStatusCode);
  }

  console.error("Unhandled application error", error);
  return c.json({ error: "internal_error", message: "An unexpected error occurred" }, 500);
};
