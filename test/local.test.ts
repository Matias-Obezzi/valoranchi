import { describe, expect, it } from "vitest";
import { parseLockfile } from "../src/local/Lockfile.js";
import { RiotClientLocalApi } from "../src/local/RiotClientLocalApi.js";
import { parseRegionFromLog, resolveRegion, shardOf } from "../src/local/RegionResolver.js";
import {
  RegionUnknownError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
} from "../src/errors.js";

describe("Lockfile", () => {
  it("parses valid lockfile content", () => {
    const parsed = parseLockfile("Riot Client:1234:5678:secret_pass");
    expect(parsed).toEqual({
      name: "Riot Client",
      pid: 1234,
      port: 5678,
      password: "secret_pass",
    });
  });

  it("returns null for malformed lockfile content", () => {
    expect(parseLockfile("")).toBeNull();
    expect(parseLockfile("invalid")).toBeNull();
    expect(parseLockfile("Riot Client:abc:5678:secret_pass")).toBeNull();
    expect(parseLockfile("Riot Client:1234:xyz:secret_pass")).toBeNull();
    expect(parseLockfile("Riot Client:1234:5678")).toBeNull();
  });
});

describe("RegionResolver", () => {
  it("computes shardOf with region overrides", () => {
    expect(shardOf("na")).toBe("na");
    expect(shardOf("eu")).toBe("eu");
    expect(shardOf("ap")).toBe("ap");
    expect(shardOf("kr")).toBe("kr");
    expect(shardOf("pbe")).toBe("pbe");
    expect(shardOf("latam")).toBe("na");
    expect(shardOf("br")).toBe("na");
    expect(shardOf("LATAM")).toBe("na");
  });

  it("parses region and shard from ShooterGame.log", () => {
    const logContent = `
[2026.03.20-10.00.00:000][  0]LogInit: Display: Running engine
[2026.03.20-10.00.01:000][  0]LogNet: CI: https://glz-latam-1.na.a.pvp.net/session/v1/sessions
`;
    const resolved = parseRegionFromLog(logContent);
    expect(resolved).toEqual({ region: "latam", shard: "na" });
  });

  it("returns null when log has no glz endpoint match", () => {
    expect(parseRegionFromLog("some random log without url")).toBeNull();
  });

  it("resolves region from primary external-sessions when available", async () => {
    const fakeApi = {
      valorantSession: async () => ({ region: "eu", shard: "eu" }),
    };
    const result = await resolveRegion(fakeApi, () => "https://glz-na-1.na.a.pvp.net");
    expect(result).toEqual({ region: "eu", shard: "eu" });
  });

  it("falls back to log when external-sessions returns null", async () => {
    const fakeApi = {
      valorantSession: async () => null,
    };
    const logText = "https://glz-ap-1.ap.a.pvp.net";
    const result = await resolveRegion(fakeApi, () => logText);
    expect(result).toEqual({ region: "ap", shard: "ap" });
  });

  it("throws RegionUnknownError when both sources fail", async () => {
    const fakeApi = {
      valorantSession: async () => null,
    };
    await expect(resolveRegion(fakeApi, () => null)).rejects.toThrow(RegionUnknownError);
  });
});

describe("RiotClientLocalApi", () => {
  it("parses external-sessions arguments successfully", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        "session-1": {
          productId: "valorant",
          launchConfiguration: {
            arguments: [
              "-ares-deployment=latam",
              "-config-endpoint=https://shared.na.a.pvp.net",
            ],
          },
        },
      }),
      text: async () => "",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
    });

    const session = await api.valorantSession();
    expect(session).toEqual({ region: "latam", shard: "na" });
  });

  it("retries on 'Entitlements token is not ready yet' and succeeds", async () => {
    let calls = 0;
    const mockFetch = async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 400,
          json: async () => ({}),
          text: async () => "Entitlements token is not ready yet",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: "mock-access",
          token: "mock-jwt",
          subject: "mock-puuid",
        }),
        text: async () => "",
      };
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    const token = await api.entitlementsToken();
    expect(calls).toBe(2);
    expect(token).toEqual({
      accessToken: "mock-access",
      token: "mock-jwt",
      subject: "mock-puuid",
    });
  });

  it("throws RiotClientNotRunningError when connection is refused", async () => {
    const connRefusedError = new Error("connect ECONNREFUSED 127.0.0.1:5678");
    (connRefusedError as { code?: string }).code = "ECONNREFUSED";

    const mockFetch = async () => {
      throw connRefusedError;
    };

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    await expect(api.entitlementsToken()).rejects.toThrow(RiotClientNotRunningError);
  });

  it("throws RiotClientNotReadyError when retries are exhausted", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => "Invalid URI format",
    });

    const api = new RiotClientLocalApi(5678, "pass", {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    await expect(api.entitlementsToken()).rejects.toThrow(RiotClientNotReadyError);
  });
});
