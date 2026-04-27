import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { ApiError, errorResponse, validationError } from "../lib/errors.js";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    return errorResponse(c, err);
  }
  if (err instanceof ZodError) {
    return errorResponse(c, validationError(err.flatten()));
  }
  console.error("[unhandled error]", err);
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR" as const,
        message:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : (err as Error).message,
      },
    },
    500,
  );
};
