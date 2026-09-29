import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiotApi } from "../src/riot/RiotApi.js";
import { FileResponseCache } from "../src/riot/ResponseCache.js";
import { Session } from "../src/riot/Session.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";

const session = new Session({
  puuid: "puuid-1",
  accessToken: "access",
  entitlementsToken: "ent",
  region: "na",
  shard: "na",
  clientVersion: "v",
});

describe("FileResponseCache", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "riot-client-responses-"));
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("serves a fresh entry and refetches once it expired", async () => {
    let clock = 1_000;
    const cache = new FileResponseCache(500, dir, () => clock);
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });

    expect(await cache.through("k", fetcher)).toEqual({ n: 1 });
    expect(await cache.through("k", fetcher)).toEqual({ n: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    clock += 600;
    await cache.through("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("caches Riot responses per player and endpoint, never the tokens", async () => {
    const get = vi.fn().mockResolvedValue({ Balances: { a: 1 } });
    const gateway = { get } as unknown as HttpGateway;
    const api = new RiotApi(gateway, session, new FileResponseCache(60_000, dir));

    await api.wallet();
    await api.wallet();
    expect(get).toHaveBeenCalledTimes(1);

    const stored = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf-8"));
    expect(stored).toHaveLength(1);
    expect(stored[0]).not.toContain("access");
    expect(stored[0]).not.toContain("ent");
  });

  it("honours an optional ttlMs override on through", async () => {
    let clock = 1_000;
    const cache = new FileResponseCache(100, dir, () => clock);
    const fetcher = vi.fn().mockResolvedValue({ val: 42 });

    await cache.through("custom-ttl", fetcher, { ttlMs: 10_000 });
    clock += 500;
    await cache.through("custom-ttl", fetcher, { ttlMs: 10_000 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    clock += 15_000;
    await cache.through("custom-ttl", fetcher, { ttlMs: 10_000 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
