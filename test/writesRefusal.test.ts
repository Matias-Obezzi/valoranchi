import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApi } from "../src/catalogue/ValorantApi.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { ValidationError } from "../src/errors.js";
import type { RiotClientLocalApi } from "../src/local/RiotClientLocalApi.js";
import { RiotClient } from "../src/RiotClient.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riot-client-writes-"));
const lockfilePath = path.join(dir, "lockfile");
fs.writeFileSync(lockfilePath, "Riot Client:1:2:secret:https");
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const localPost = vi.fn();
const localApi = {
  entitlementsToken: async () => ({ accessToken: "a", token: "t", subject: "me" }),
  valorantSession: async () => ({ region: "na", shard: "na" }),
  get: async (route: string) => (route.includes("session") ? { puuid: "me" } : {}),
  post: localPost,
  delete: vi.fn(),
  close: async () => undefined,
} as unknown as RiotClientLocalApi;

const put = vi.fn().mockResolvedValue([]);
const gateway = {
  get: vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("/personalization/")) {
      return {
        Subject: "me",
        Version: 1,
        Guns: [],
        ActiveExpressions: [],
        Identity: {},
        Incognito: false,
      };
    }
    if (url.includes("/entitlements/")) return { EntitlementsByTypes: [] };
    if (url.includes("/account-xp/")) return { Progress: { Level: 10, XP: 0 } };
    return {};
  }),
  put,
  post: vi.fn(),
} as unknown as HttpGateway;

const client = new RiotClient({
  lockfilePath,
  catalogueDir: null,
  gateway,
  valorantApi: {
    getClientVersion: async () => "v",
    getCatalogue: async () => new Catalogue(catalogueData),
  } as unknown as ValorantApi,
  localApiFactory: () => localApi,
});

describe("refused writes never reach Riot", () => {
  it("does not put a loadout with a card the account does not own", async () => {
    await expect(
      client.equip({ card: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(put.mock.calls.some(([url]) => String(url).includes("/personalization/"))).toBe(false);
  });

  it("does not post a message to someone who is not a friend", async () => {
    await expect(
      client.sendMessage({ puuid: "00000000-0000-0000-0000-000000000000" }, "hi"),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(localPost).not.toHaveBeenCalled();
  });
});
