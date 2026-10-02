import { describe, expect, it, vi } from "vitest";
import { OfficialApiKeyMissingError, RiotApiError, ValidationError } from "../src/errors.js";
import { OfficialApi } from "../src/official/OfficialApi.js";
import { HttpGateway } from "../src/riot/HttpGateway.js";

describe("OfficialApi", () => {
  it("throws OfficialApiKeyMissingError and makes zero requests when key is missing", async () => {
    const mockFetch = vi.fn();
    const gateway = new HttpGateway(mockFetch);
    const api = new OfficialApi(gateway, "");

    await expect(api.accountByRiotId("Player", "TAG")).rejects.toThrow(
      OfficialApiKeyMissingError,
    );
    await expect(api.match("na", "match-123")).rejects.toThrow(OfficialApiKeyMissingError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws ValidationError for invalid shard before making any request", async () => {
    const mockFetch = vi.fn();
    const gateway = new HttpGateway(mockFetch);
    const api = new OfficialApi(gateway, "test-api-key");

    await expect(api.match("invalid-shard", "match-123")).rejects.toThrow(ValidationError);
    await expect(api.matchlist("oce", "puuid-1")).rejects.toThrow(ValidationError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls account and shard endpoints with X-Riot-Token header", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/accounts/by-riot-id/")) {
        return new Response(JSON.stringify({ puuid: "p1", gameName: "Jett", tagLine: "NA1" }), {
          status: 200,
        });
      }
      if (url.includes("/active-shards/")) {
        return new Response(JSON.stringify({ puuid: "p1", game: "val", activeShard: "na" }), {
          status: 200,
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const gateway = new HttpGateway(mockFetch);
    const api = new OfficialApi(gateway, "rgapi-key");

    const acc = await api.accountByRiotId("Jett", "NA1");
    expect(acc).toEqual({ puuid: "p1", gameName: "Jett", tagLine: "NA1" });

    const shard = await api.activeShard("p1");
    expect(shard).toEqual({ puuid: "p1", game: "val", activeShard: "na" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Jett/NA1",
      expect.objectContaining({
        headers: { "X-Riot-Token": "rgapi-key" },
      }),
    );
  });

  it("returns null on 404 for unknown resources", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }));
    const gateway = new HttpGateway(mockFetch);
    const api = new OfficialApi(gateway, "test-key");

    const result = await api.match("na", "non-existent-match");
    expect(result).toBeNull();
  });

  it("retries once on 429 using Retry-After header", async () => {
    let attempts = 0;
    const sleepCalls: number[] = [];
    const mockFetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        return new Response("Rate limit", {
          status: 429,
          headers: { "Retry-After": "3" },
        });
      }
      return new Response(JSON.stringify({ puuid: "p1", history: [] }), { status: 200 });
    });

    const gateway = new HttpGateway(mockFetch);
    const api = new OfficialApi(gateway, "test-key", {
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
    });

    const res = await api.matchlist("eu", "p1");
    expect(attempts).toBe(2);
    expect(sleepCalls).toEqual([3000]);
    expect(res).toEqual({ puuid: "p1", history: [] });
  });

  it("retries once on 5xx transient server error after 500ms", async () => {
    let attempts = 0;
    const sleepCalls: number[] = [];
    const mockFetch = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        return new Response("Server error", { status: 503 });
      }
      return new Response(JSON.stringify({ id: "kr", name: "Korea", maintenances: [], incidents: [] }), {
        status: 200,
      });
    });

    const gateway = new HttpGateway(mockFetch);
    const api = new OfficialApi(gateway, "test-key", {
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
    });

    const res = await api.platformStatus("kr");
    expect(attempts).toBe(2);
    expect(sleepCalls).toEqual([500]);
    expect(res.id).toBe("kr");
  });

  it("rethrows error when retry fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("Gateway Timeout", { status: 504 }));
    const gateway = new HttpGateway(mockFetch);
    const api = new OfficialApi(gateway, "test-key", {
      sleep: async () => {},
    });

    await expect(api.platformStatus("ap")).rejects.toThrow(RiotApiError);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
