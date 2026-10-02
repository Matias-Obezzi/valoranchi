import { RiotClientError, ValidationError } from "./errors.js";

export interface FormattedError {
  error: {
    code: string;
    message: string;
    reason?: string;
    details?: Record<string, unknown>;
  };
}

export function formatError(error: unknown): FormattedError {
  if (error instanceof ValidationError) {
    return {
      error: {
        code: error.code,
        reason: error.reason,
        message: error.message,
        details: error.details,
      },
    };
  }
  if (error instanceof RiotClientError) {
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    error: {
      code: "UNKNOWN_ERROR",
      message,
    },
  };
}
