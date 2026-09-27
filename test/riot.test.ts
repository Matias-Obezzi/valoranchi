import { describe, expect, it, vi } from "vitest";
import { Session } from "../src/riot/Session.js";
import { HttpGateway } from "../src/riot/HttpGateway.js";
import { RiotApi } from "../src/riot/RiotApi.js";
import { ForbiddenHostError, RiotApiError } from "../src/errors.js";

describe("Session", () => {
  const session = new Session({
    puuid: "puuid-1234",
    accessToken: "access-token-xyz",
    entitlementsToken: "entitlements-jwt-abc",
    region: "latam",
    shard: "na",
    clientVersion: "release-09.00-shipping-123",
  });

  it("constructs endpoints based on region and shard", () => {
    expect(session.endpoints.pd).toBe("https://pd.na.a.pvp.net");
    expect(session.endpoints.glz).toBe("https://glz-latam-1.na.a.pvp.net");
    expect(session.endpoints.shared).toBe("https://shared.na.a.pvp.net");
  });

  it("includes the four required headers and decodes platform JSON", () => {
    const headers = session.headers();
    expect(headers["Authorization"]).toBe("Bearer access-token-xyz");
    expect(headers["X-Riot-Entitlements-JWT"]).toBe("entitlements-jwt-abc");
    expect(headers["X-Riot-ClientVersion"]).toBe("release-09.00-shipping-123");

    const platformRaw = headers["X-Riot-ClientPlatform"];
    expect(platformRaw).toBeDefined();
    const decoded = JSON.parse(Buffer.from(platformRaw, "base64").toString("utf-8"));
    expect(decoded).toEqual({
      platformType: "PC",
      platformOS: "Windows",
      platformOSVersion: "10.0.19042.1.256.64bit",
      platformChipset: "Unknown",
    });
  });
});

describe("HttpGateway", () => {
  it("rejects untrusted host before calling fetch", async () => {
    const mockFetch = vi.fn();
    const gateway = new HttpGateway(mockFetch);

    await expect(gateway.get("https://evil.example/x")).rejects.toThrow(ForbiddenHostError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects token headers sent to valorant-api.com", async () => {
    const mockFetch = vi.fn();
    const gateway = new HttpGateway(mockFetch);

    await expect(
      gateway.get("https://valorant-api.com/v1/version", {
        Authorization: "Bearer secret",
      }),
    ).rejects.toThrow(ForbiddenHostError);

    await expect(
      gateway.get("https://valorant-api.com/v1/version", {
        "X-Riot-Entitlements-JWT": "jwt-secret",
      }),
    ).rejects.toThrow(ForbiddenHostError);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("allows requests to valorant-api.com without auth headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 200, data: { riotClientVersion: "1.0.0" } }), {
        status: 200,
      }),
    );
    const gateway = new HttpGateway(mockFetch);

    const result = await gateway.get<{ status: number }>("https://valorant-api.com/v1/version");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
  });

  it("allows requests to *.pvp.net with auth headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
      }),
    );
    const gateway = new HttpGateway(mockFetch);

    await gateway.get("https://pd.na.a.pvp.net/store/v1/wallet/123", {
      Authorization: "Bearer secret",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("maps non-2xx responses to RiotApiError with sanitized url", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Not Found", {
        status: 404,
      }),
    );
    const gateway = new HttpGateway(mockFetch);

    const error = await gateway
      .get("https://pd.na.a.pvp.net/store/v1/wallet/123?param=secret")
      .catch((e) => e);

    expect(error).toBeInstanceOf(RiotApiError);
    expect((error as RiotApiError).status).toBe(404);
    expect((error as RiotApiError).url).toBe("https://pd.na.a.pvp.net/store/v1/wallet/123");
  });
});

describe("RiotApi", () => {
  const session = new Session({
    puuid: "puuid-1234",
    accessToken: "access-token-xyz",
    entitlementsToken: "entitlements-jwt-abc",
    region: "latam",
    shard: "na",
    clientVersion: "release-09.00-shipping-123",
  });

  it("calls entitlements endpoint with session headers and puuid", async () => {
    const mockGet = vi.fn().mockResolvedValue({ EntitlementsByTypes: [] });
    const fakeGateway = {
      get: mockGet,
      put: vi.fn(),
    } as unknown as HttpGateway;

    const api = new RiotApi(fakeGateway, session);
    await api.entitlements();

    expect(mockGet).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/store/v1/entitlements/puuid-1234",
      expect.objectContaining({
        Authorization: "Bearer access-token-xyz",
      }),
    );
  });

  it("calls names endpoint with PUT and puuids array", async () => {
    const mockPut = vi.fn().mockResolvedValue([{ Subject: "puuid-1234", GameName: "Jett", TagLine: "1234" }]);
    const fakeGateway = {
      get: vi.fn(),
      put: mockPut,
    } as unknown as HttpGateway;

    const api = new RiotApi(fakeGateway, session);
    const names = await api.names(["puuid-1234"]);

    expect(mockPut).toHaveBeenCalledWith(
      "https://pd.na.a.pvp.net/name-service/v2/players",
      ["puuid-1234"],
      expect.objectContaining({
        Authorization: "Bearer access-token-xyz",
      }),
    );
    expect(names[0].GameName).toBe("Jett");
  });
});
