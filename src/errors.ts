export class RiotClientError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class RiotClientNotRunningError extends RiotClientError {
  constructor(message = "Riot Client is not running") {
    super(message, "RIOT_CLIENT_NOT_RUNNING");
  }
}

export class RiotClientNotReadyError extends RiotClientError {
  constructor(message = "Riot Client is not ready yet") {
    super(message, "RIOT_CLIENT_NOT_READY");
  }
}

export class RegionUnknownError extends RiotClientError {
  constructor(message = "Could not resolve region and shard") {
    super(message, "REGION_UNKNOWN");
  }
}

export class ForbiddenHostError extends RiotClientError {
  constructor(host: string) {
    super(`Host '${host}' is not allowed to receive Riot credentials`, "FORBIDDEN_HOST");
  }
}

export class RiotApiError extends RiotClientError {
  readonly status: number;
  readonly url: string;

  constructor(status: number, rawUrl: string, message?: string) {
    const sanitizedUrl = rawUrl.split("?")[0]!;
    super(
      message ?? `Riot API request to ${sanitizedUrl} failed with status ${status}`,
      "RIOT_API_ERROR",
    );
    this.status = status;
    this.url = sanitizedUrl;
  }
}

export class ValidationError extends RiotClientError {
  readonly reason: string;
  readonly details: Record<string, unknown>;

  constructor(
    reason: string,
    messageOrDetails?: string | Record<string, unknown>,
    details?: Record<string, unknown>,
  ) {
    const message = typeof messageOrDetails === "string" ? messageOrDetails : reason;
    const finalDetails =
      typeof messageOrDetails === "object" && messageOrDetails !== null
        ? messageOrDetails
        : (details ?? {});
    super(message, "VALIDATION");
    this.reason = reason;
    this.details = finalDetails;
  }
}
