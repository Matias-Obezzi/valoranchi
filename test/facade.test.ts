import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RiotClient } from "../src/RiotClient.js";
import { RiotClientNotRunningError } from "../src/errors.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";
import type { ValorantApi } from "../src/catalogue/ValorantApi.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import type { RiotClientLocalApi } from "../src/local/RiotClientLocalApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("RiotClient facade", () => {
  const catalogueData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData;

  it("throws RiotClientNotRunningError when lockfile is absent", async () => {
    const client = new RiotClient({
      lockfilePath: "non-existent-path/lockfile",
    });
    await expect(client.whoami()).rejects.toThrow(RiotClientNotRunningError);
  });

  it("caches session and deduplicates concurrent session creation", async () => {
    const tempDir = path.join(__dirname, "tmp-test");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    let createCalls = 0;
    const mockLocalApi = {
      entitlementsToken: async () => {
        createCalls++;
        return {
          accessToken: "access",
          token: "token",
          subject: "puuid-1",
        };
      },
      valorantSession: async () => ({
        region: "na",
        shard: "na",
      }),
    } as unknown as RiotClientLocalApi;

    const mockGateway = {
      get: vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/store/v1/wallet/")) {
          return {
            Balances: {
              "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741": 1500,
              "e59aa87c-4cbf-517a-5983-6e81511be9b7": 80,
              "85ca954a-41f2-ce94-9b45-8ca3dd39a00d": 4000,
            },
          };
        }
        if (url.includes("/account-xp/v1/players/")) {
          return { Progress: { Level: 50, XP: 0 } };
        }
        if (url.includes("/personalization/v3/players/")) {
          return {
            Guns: [],
            Sprays: [],
            Identity: { AccountLevel: 50 },
            Incognito: false,
          };
        }
        return {};
      }),
      put: vi.fn().mockResolvedValue([{ Subject: "puuid-1", GameName: "Jett", TagLine: "1234" }]),
    } as unknown as HttpGateway;

    const mockValorantApi = {
      getClientVersion: async () => "1.0.0",
      getCatalogue: async () => new Catalogue(catalogueData),
    } as unknown as ValorantApi;

    const client = new RiotClient({
      lockfilePath,
      gateway: mockGateway,
      valorantApi: mockValorantApi,
      localApiFactory: () => mockLocalApi,
      sessionTtlMs: 5000,
    });

    const [wallet1, wallet2] = await Promise.all([client.wallet(), client.wallet()]);

    expect(wallet1).toEqual({
      valorantPoints: 1500,
      radianite: 80,
      kingdomCredits: 4000,
    });
    expect(wallet2).toEqual(wallet1);
    expect(createCalls).toBe(1);

    const whoami = await client.whoami();
    expect(whoami).toEqual({
      puuid: "puuid-1",
      gameName: "Jett",
      tagLine: "1234",
      region: "na",
      shard: "na",
      accountLevel: 50,
    });
    expect(createCalls).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("fetches the loadout endpoint exactly once during loadout()", async () => {
    const tempDir = path.join(__dirname, "tmp-test-loadout");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const lockfilePath = path.join(tempDir, "lockfile");
    fs.writeFileSync(lockfilePath, "Riot Client:100:200:test_password");

    const mockLocalApi = {
      entitlementsToken: async () => ({
        accessToken: "access",
        token: "token",
        subject: "puuid-1",
      }),
      valorantSession: async () => ({
        region: "na",
        shard: "na",
      }),
    } as unknown as RiotClientLocalApi;

    let loadoutCalls = 0;
    const mockGateway = {
      get: vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/account-xp/v1/players/")) {
          return { Progress: { Level: 50, XP: 0 } };
        }
        if (url.includes("/personalization/v3/players/")) {
          loadoutCalls++;
          return {
            Guns: [],
            Sprays: [],
            Identity: { AccountLevel: 50 },
            Incognito: false,
          };
        }
        return {};
      }),
      put: vi.fn().mockResolvedValue([{ Subject: "puuid-1", GameName: "Jett", TagLine: "1234" }]),
    } as unknown as HttpGateway;

    const mockValorantApi = {
      getClientVersion: async () => "1.0.0",
      getCatalogue: async () => new Catalogue(catalogueData),
    } as unknown as ValorantApi;

    const client = new RiotClient({
      lockfilePath,
      gateway: mockGateway,
      valorantApi: mockValorantApi,
      localApiFactory: () => mockLocalApi,
    });

    const loadout = await client.loadout();
    expect(loadout.player.gameName).toBe("Jett");
    expect(loadoutCalls).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
