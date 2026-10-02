import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreApi } from "../src/client/api.js";
import { ValidationError } from "../src/errors.js";
import type { Store, Wishlist, WishlistHit } from "../src/model/index.js";
import { RiotClient } from "../src/RiotClient.js";
import { StoreWatcher } from "../src/watch/StoreWatcher.js";
import { WebhookNotifier } from "../src/watch/WebhookNotifier.js";

const sampleHit: WishlistHit = {
  skin: {
    uuid: "skin-1",
    name: "Prime Vandal",
    weapon: "Vandal",
    icon: "icon.png",
  },
  where: "daily",
  price: 1775,
  discountedPrice: null,
  bundleName: null,
  endsAt: "2026-10-02T12:00:00.000Z",
};

describe("WebhookNotifier", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects non-https URLs and invalid URLs", () => {
    expect(() => new WebhookNotifier("http://example.com/webhook")).toThrowError(ValidationError);
    expect(() => new WebhookNotifier("not-a-url")).toThrowError(ValidationError);
  });

  it("builds Discord format for discord.com webhook URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchSpy;

    const notifier = new WebhookNotifier("https://discord.com/api/webhooks/123/abc");
    await notifier.notify(sampleHit);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://discord.com/api/webhooks/123/abc");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    const parsedBody = JSON.parse(init.body as string) as { content: string };
    expect(parsedBody.content).toBe("Prime Vandal is in your daily store for 1775 VP");
  });

  it("builds Discord format with discounted price for night market", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchSpy;

    const nmHit: WishlistHit = {
      ...sampleHit,
      where: "night-market",
      price: 1775,
      discountedPrice: 1242,
    };

    const notifier = new WebhookNotifier("https://discordapp.com/api/webhooks/123/abc");
    await notifier.notify(nmHit);

    const [, init] = fetchSpy.mock.calls[0]!;
    const parsedBody = JSON.parse(init.body as string) as { content: string };
    expect(parsedBody.content).toBe("Prime Vandal is in your night market for 1242 VP");
  });

  it("posts raw WishlistHit JSON for non-Discord URLs", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchSpy;

    const notifier = new WebhookNotifier("https://my-server.example.com/alerts");
    await notifier.notify(sampleHit);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const parsedBody = JSON.parse(init.body as string) as WishlistHit;
    expect(parsedBody).toEqual(sampleHit);
  });

  it("throws Error on non-ok HTTP response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const notifier = new WebhookNotifier("https://my-server.example.com/alerts");
    await expect(notifier.notify(sampleHit)).rejects.toThrowError(
      "Webhook notification failed with status 500",
    );
  });
});

describe("StoreWatcher", () => {
  let mockStore: Store;
  let mockWishlist: Wishlist;
  let fakeStoreApi: StoreApi;

  beforeEach(() => {
    mockStore = {
      player: {
        puuid: "p1",
        gameName: "Player",
        tagLine: "NA1",
        region: "na",
        shard: "na",
        accountLevel: 50,
      },
      fetchedAt: "2026-10-02T00:00:00.000Z",
      daily: {
        endsAt: "2026-10-02T12:00:00.000Z",
        offers: [
          {
            offerId: "o-1",
            cost: { currency: "VP", currencyUuid: "vp", amount: 1775 },
            item: {
              kind: "skin",
              uuid: "skin-1",
              name: "Prime Vandal",
              weapon: "Vandal",
              tier: null,
              icon: "icon.png",
              levelUuid: "lvl-1",
            },
          },
        ],
      },
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    };

    mockWishlist = {
      skins: [{ uuid: "skin-1", name: "Prime Vandal", addedAt: "2026-10-01T00:00:00.000Z" }],
    };

    fakeStoreApi = {
      current: vi.fn().mockImplementation(async () => mockStore),
      wishlist: vi.fn().mockImplementation(async () => mockWishlist),
    } as unknown as StoreApi;
  });

  it("emits hit once per rotation and again after endsAt changes", async () => {
    const watcher = new StoreWatcher(fakeStoreApi, { intervalMs: 1000 });
    const hitSpy = vi.fn();
    watcher.on("hit", hitSpy);

    await watcher.check();
    expect(hitSpy).toHaveBeenCalledTimes(1);

    // Same rotation check does not emit duplicate
    await watcher.check();
    expect(hitSpy).toHaveBeenCalledTimes(1);

    // New rotation with new endsAt
    mockStore = {
      ...mockStore,
      daily: {
        ...mockStore.daily!,
        endsAt: "2026-10-03T12:00:00.000Z",
      },
    };

    await watcher.check();
    expect(hitSpy).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("emits error on failures without stopping", async () => {
    let shouldFail = true;
    const failingStoreApi = {
      current: vi.fn().mockImplementation(async () => {
        if (shouldFail) throw new Error("Network error");
        return mockStore;
      }),
      wishlist: vi.fn().mockImplementation(async () => mockWishlist),
    } as unknown as StoreApi;

    const watcher = new StoreWatcher(failingStoreApi, { intervalMs: 1000 });
    const errorSpy = vi.fn();
    const hitSpy = vi.fn();
    watcher.on("error", errorSpy);
    watcher.on("hit", hitSpy);

    await watcher.check();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(hitSpy).toHaveBeenCalledTimes(0);

    // Next check succeeds
    shouldFail = false;
    await watcher.check();
    expect(hitSpy).toHaveBeenCalledTimes(1);

    watcher.stop();
  });

  it("forwards webhook errors to error event without throwing", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    try {
      const watcher = new StoreWatcher(fakeStoreApi, {
        webhook: "https://discord.com/api/webhooks/123/abc",
        intervalMs: 1000,
      });
      const errorSpy = vi.fn();
      watcher.on("error", errorSpy);

      await watcher.check();

      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledTimes(1);
      });

      watcher.stop();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("yields items as async iterable", async () => {
    const watcher = new StoreWatcher(fakeStoreApi, { intervalMs: 5000 });
    const iterator = watcher[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    const item = await nextPromise;

    expect(item.done).toBe(false);
    expect(item.value.event).toBe("hit");
    expect((item.value.data as WishlistHit).skin.name).toBe("Prime Vandal");

    watcher.stop();
  });

  it("can be created via client.watch.store", () => {
    const client = new RiotClient({ lockfilePath: "non-existent" });
    const watcher = client.watch.store();
    expect(watcher).toBeInstanceOf(StoreWatcher);
  });
});
