import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadWishlist, saveWishlist, wishlistHits } from "../src/analysis/wishlist.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import type { Store, Wishlist } from "../src/model/index.js";

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
