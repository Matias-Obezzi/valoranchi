import { describe, expect, it } from "vitest";
import {
  ForbiddenHostError,
  RegionUnknownError,
  RiotApiError,
  RiotClientError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
} from "../src/errors.js";

describe("errors", () => {
  it("creates base RiotClientError with message and code", () => {
    const error = new RiotClientError("Custom error", "CUSTOM_CODE");
    expect(error.message).toBe("Custom error");
    expect(error.code).toBe("CUSTOM_CODE");
    expect(error.name).toBe("RiotClientError");
    expect(error instanceof Error).toBe(true);
  });

  it("creates specific error types with default codes", () => {
    const notRunning = new RiotClientNotRunningError();
    expect(notRunning.code).toBe("RIOT_CLIENT_NOT_RUNNING");
    expect(notRunning instanceof RiotClientError).toBe(true);

    const notReady = new RiotClientNotReadyError();
    expect(notReady.code).toBe("RIOT_CLIENT_NOT_READY");
    expect(notReady instanceof RiotClientError).toBe(true);

    const regionUnknown = new RegionUnknownError();
    expect(regionUnknown.code).toBe("REGION_UNKNOWN");
    expect(regionUnknown instanceof RiotClientError).toBe(true);

    const forbidden = new ForbiddenHostError("evil.com");
    expect(forbidden.code).toBe("FORBIDDEN_HOST");
    expect(forbidden.message).toContain("evil.com");
    expect(forbidden instanceof RiotClientError).toBe(true);
  });

  it("sanitizes url in RiotApiError by stripping query strings", () => {
    const apiError = new RiotApiError(404, "https://pd.na.a.pvp.net/store/v1/wallet/123?token=secret");
    expect(apiError.status).toBe(404);
    expect(apiError.url).toBe("https://pd.na.a.pvp.net/store/v1/wallet/123");
    expect(apiError.code).toBe("RIOT_API_ERROR");
    expect(apiError.message).not.toContain("secret");
  });
});
