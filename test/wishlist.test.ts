import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWishlist, saveWishlist, wishlistHits } from "../src/analysis/wishlist.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { StoreService } from "../src/client/StoreService.js";
import type { ClientContext } from "../src/client/ClientContext.js";
import type { Store, Wishlist } from "../src/model/index.js";
import { ENTITLEMENT_ITEM_TYPES } from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;
const catalogue = new Catalogue(catalogueData);

describe("Catalogue.findSkin", () => {
  it("finds skin by exact and lowercase uuid", () => {
    const skin = catalogue.findSkin("8908F237-47B2-031A-E905-1A89C93CC8F5");
    expect(skin).toBeDefined();
    expect(skin?.displayName).toBe("Prime Vandal");
  });

  it("finds skin by display name case-insensitively", () => {
    const skin = catalogue.findSkin("prime vandal");
    expect(skin).toBeDefined();
    expect(skin?.uuid).toBe("8908f237-47b2-031a-e905-1a89c93cc8f5");
  });

  it("returns undefined for unknown skin", () => {
    const skin = catalogue.findSkin("NonExistentSkin 9999");
    expect(skin).toBeUndefined();
  });
});

describe("wishlist persistence", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wishlist-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty wishlist when file does not exist", () => {
    const wishlist = loadWishlist(tempDir, "player-1");
    expect(wishlist).toEqual({ skins: [] });
  });

  it("saves and loads wishlist round-trip", () => {
    const sample: Wishlist = {
      skins: [
        {
          uuid: "8908f237-47b2-031a-e905-1a89c93cc8f5",
          name: "Prime Vandal",
          addedAt: "2026-10-02T12:00:00.000Z",
        },
      ],
    };

    saveWishlist(tempDir, "player-1", sample);
    const loaded = loadWishlist(tempDir, "player-1");
    expect(loaded).toEqual(sample);
  });
});

describe("wishlistHits", () => {
  const primeUuid = "8908f237-47b2-031a-e905-1a89c93cc8f5";
  const reaverUuid = "b86377e7-4971-d41c-b174-cb904a4ab5a7";
  const ionUuid = "29b449b2-4d57-3f36-39ee-c08182f0727e";
  const nonSkinUuid = "spray-uuid-1234";

  const wishlist: Wishlist = {
    skins: [
      { uuid: primeUuid, name: "Prime Vandal", addedAt: "2026-10-01T00:00:00Z" },
      { uuid: reaverUuid, name: "Reaver Vandal", addedAt: "2026-10-01T00:00:00Z" },
      { uuid: ionUuid, name: "Ion Phantom", addedAt: "2026-10-01T00:00:00Z" },
      { uuid: nonSkinUuid, name: "Not A Skin", addedAt: "2026-10-01T00:00:00Z" },
    ],
  };

  const store: Store = {
    player: {
      puuid: "p1",
      gameName: "Player",
      tagLine: "1",
      region: "na",
      shard: "na",
      accountLevel: 100,
    },
    fetchedAt: "2026-10-02T00:00:00.000Z",
    daily: {
      endsAt: "2026-10-03T00:00:00.000Z",
      offers: [
        {
          offerId: "daily-1",
          cost: { currency: "VP", currencyUuid: "vp-id", amount: 1775 },
          item: {
            kind: "skin",
            uuid: primeUuid,
            name: "Prime Vandal",
            weapon: "Vandal",
            tier: null,
            icon: "prime.png",
            levelUuid: "lvl-prime",
          },
        },
      ],
    },
    nightMarket: {
      endsAt: "2026-10-10T00:00:00.000Z",
      offers: [
        {
          offerId: "nm-1",
          cost: { currency: "VP", currencyUuid: "vp-id", amount: 1775 },
          discountedCost: { currency: "VP", currencyUuid: "vp-id", amount: 1242 },
          discountPercent: 30,
          seen: true,
          item: {
            kind: "skin",
            uuid: reaverUuid,
            name: "Reaver Vandal",
            weapon: "Vandal",
            tier: null,
            icon: "reaver.png",
            levelUuid: "lvl-reaver",
          },
        },
      ],
    },
    bundles: {
      endsAt: "2026-10-15T00:00:00.000Z",
      items: [
        {
          uuid: "bundle-1",
          name: "Ion Collection",
          subtitle: null,
          description: null,
          icon: "ion.png",
          promoImage: "ion-promo.png",
          currency: "VP",
          totalBase: 7100,
          totalDiscounted: 5000,
          discountPercent: 30,
          wholesaleOnly: false,
          endsAt: "2026-10-15T00:00:00.000Z",
          items: [
            {
              item: {
                kind: "skin",
                uuid: ionUuid,
                name: "Ion Phantom",
                weapon: "Phantom",
                tier: null,
                icon: "ion-phantom.png",
                levelUuid: "lvl-ion",
              },
              amount: 1,
              basePrice: 1775,
              discountedPrice: 1242,
              discountPercent: 30,
              promo: false,
            },
            {
              item: {
                kind: "spray",
                uuid: nonSkinUuid,
                name: "Ion Spray",
                icon: "spray.png",
              },
              amount: 1,
              basePrice: 325,
              discountedPrice: 325,
              discountPercent: 0,
              promo: false,
            },
          ],
        },
      ],
    },
    accessories: null,
    radianite: [],
  };

  it("finds skin in daily, night market, and bundle while ignoring non skins", () => {
    const hits = wishlistHits(store, wishlist);

    expect(hits).toHaveLength(3);

    expect(hits[0]).toEqual({
      skin: {
        uuid: primeUuid,
        name: "Prime Vandal",
        weapon: "Vandal",
        icon: "prime.png",
      },
      where: "daily",
      price: 1775,
      discountedPrice: null,
      bundleName: null,
      endsAt: "2026-10-03T00:00:00.000Z",
    });

    expect(hits[1]).toEqual({
      skin: {
        uuid: reaverUuid,
        name: "Reaver Vandal",
        weapon: "Vandal",
        icon: "reaver.png",
      },
      where: "night-market",
      price: 1775,
      discountedPrice: 1242,
      bundleName: null,
      endsAt: "2026-10-10T00:00:00.000Z",
    });

    expect(hits[2]).toEqual({
      skin: {
        uuid: ionUuid,
        name: "Ion Phantom",
        weapon: "Phantom",
        icon: "ion-phantom.png",
      },
      where: "bundle",
      price: 1775,
      discountedPrice: 1242,
      bundleName: "Ion Collection",
      endsAt: "2026-10-15T00:00:00.000Z",
    });
  });

  it("returns empty array when wishlist has no matches", () => {
    const emptyWishlist: Wishlist = { skins: [] };
    expect(wishlistHits(store, emptyWishlist)).toEqual([]);

    const unmatchedWishlist: Wishlist = {
      skins: [{ uuid: "unmatched-uuid", name: "Other", addedAt: "now" }],
    };
    expect(wishlistHits(store, unmatchedWishlist)).toEqual([]);
  });
});

const storefrontFixture = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "storefront.json"), "utf-8"),
);

describe("StoreService wishlist methods", () => {
  let tempDir: string;
  const postSpy = vi.fn();
  const putSpy = vi.fn();
  const primeLevelUuid = "7209796e-4f76-88c9-04fa-fb81498b5e9d";

  function makeContext(ownedLevelUuids: string[] = []): ClientContext {
    return {
      language: "en-US",
      cacheDir: tempDir,
      catalogue: async () => catalogue,
      valorantApi: {} as unknown as ClientContext["valorantApi"],
      sessions: {
        session: async () => ({
          puuid: "player-123",
          headers: () => ({}),
        }),
      } as unknown as ClientContext["sessions"],
      api: () =>
        ({
          entitlements: async () => ({
            EntitlementsByTypes: [
              {
                ItemTypeID: ENTITLEMENT_ITEM_TYPES.skinLevel,
                Entitlements: ownedLevelUuids.map((id) => ({ ItemID: id })),
              },
            ],
          }),
          storefront: async () => storefrontFixture,
          offers: async () => ({ Offers: [] }),
        }) as unknown as ReturnType<ClientContext["api"]>,
      player: async () => ({
        puuid: "player-123",
        gameName: "Tester",
        tagLine: "NA1",
        region: "na",
        shard: "na",
        accountLevel: 50,
      }),
      gateway: {
        post: postSpy,
        put: putSpy,
      } as unknown as ClientContext["gateway"],
    };
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "store-wishlist-test-"));
    postSpy.mockClear();
    putSpy.mockClear();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("wishlist returns empty initially and then persists added items", async () => {
    const service = new StoreService(makeContext());
    const initial = await service.wishlist();
    expect(initial).toEqual({ skins: [] });
  });

  it("wishlistAdd rejects unknown skin without Riot request", async () => {
    const service = new StoreService(makeContext());
    await expect(service.wishlistAdd("Totally Unknown Skin 12345")).rejects.toThrowError(
      expect.objectContaining({ reason: "unknown-skin" }),
    );
    expect(postSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("wishlistAdd rejects default skin without Riot request", async () => {
    const service = new StoreService(makeContext());
    await expect(service.wishlistAdd("Standard Vandal")).rejects.toThrowError(
      expect.objectContaining({ reason: "skin-not-purchasable" }),
    );
    expect(postSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("wishlistAdd rejects already owned skin without Riot mutation", async () => {
    const service = new StoreService(makeContext([primeLevelUuid]));
    await expect(service.wishlistAdd("Prime Vandal")).rejects.toThrowError(
      expect.objectContaining({ reason: "skin-owned" }),
    );
    expect(postSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("wishlistAdd adds valid skin and does not duplicate if already listed", async () => {
    const service = new StoreService(makeContext());
    const updated = await service.wishlistAdd("Prime Vandal");
    expect(updated.skins).toHaveLength(1);
    expect(updated.skins[0]?.name).toBe("Prime Vandal");
    expect(updated.skins[0]?.uuid).toBe("8908f237-47b2-031a-e905-1a89c93cc8f5");
    expect(postSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();

    const secondAdd = await service.wishlistAdd("Prime Vandal");
    expect(secondAdd.skins).toHaveLength(1);
  });

  it("wishlistRemove removes an item by name or uuid", async () => {
    const service = new StoreService(makeContext());
    await service.wishlistAdd("Prime Vandal");
    const afterRemove = await service.wishlistRemove("Prime Vandal");
    expect(afterRemove.skins).toHaveLength(0);
  });

  it("wishlistCheck checks active store against wishlist", async () => {
    const service = new StoreService(makeContext());
    await service.wishlistAdd("Prime Vandal");
    const check = await service.wishlistCheck();
    expect(check.checkedAt).toBeDefined();
    expect(check.hits.length).toBeGreaterThanOrEqual(1);
    expect(
      check.hits.some((h) => h.skin.name === "Prime Vandal" && h.where === "daily"),
    ).toBe(true);
  });
});
