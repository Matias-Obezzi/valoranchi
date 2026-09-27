import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { StoreBuilder } from "../src/collection/StoreBuilder.js";
import type { Player } from "../src/model/index.js";
import type { RiotStorefrontResponse } from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

const storefrontFixture = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "storefront.json"), "utf-8"),
) as RiotStorefrontResponse;

const testPlayer: Player = {
  puuid: "player-1",
  gameName: "PlayerOne",
  tagLine: "1234",
  region: "latam",
  shard: "na",
  accountLevel: 50,
};

describe("StoreBuilder", () => {
  const catalogue = new Catalogue(catalogueData);
  const fixedTime = "2026-09-27T12:00:00.000Z";
  const fixedMs = new Date(fixedTime).getTime();

  it("builds all 5 storefront sections from fixture", () => {
    const builder = new StoreBuilder(testPlayer, storefrontFixture, catalogue, fixedMs);
    const store = builder.build();

    expect(store.player).toEqual(testPlayer);
    expect(store.fetchedAt).toBe(fixedTime);

    // 1. Daily
    expect(store.daily).not.toBeNull();
    expect(store.daily?.endsAt).toBe(new Date(fixedMs + 3600 * 1000).toISOString());
    expect(store.daily?.offers).toHaveLength(1);
    const dailyOffer = store.daily!.offers[0]!;
    expect(dailyOffer.offerId).toBe("offer-daily-1");
    expect(dailyOffer.cost).toEqual({
      currency: "Valorant Points",
      currencyUuid: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
      amount: 1775,
    });
    expect(dailyOffer.item.kind).toBe("skin");
    if (dailyOffer.item.kind === "skin") {
      expect(dailyOffer.item.name).toBe("Prime Vandal");
      expect(dailyOffer.item.weapon).toBe("Vandal");
      expect(dailyOffer.item.tier?.name).toBe("Exclusive");
    }

    // 2. Night Market
    expect(store.nightMarket).not.toBeNull();
    expect(store.nightMarket?.endsAt).toBe(new Date(fixedMs + 86400 * 1000).toISOString());
    expect(store.nightMarket?.offers).toHaveLength(1);
    const nightOffer = store.nightMarket!.offers[0]!;
    expect(nightOffer.offerId).toBe("offer-bonus-1");
    expect(nightOffer.discountPercent).toBe(35);
    expect(nightOffer.seen).toBe(true);
    expect(nightOffer.discountedCost.amount).toBe(1153);
    expect(nightOffer.item.kind).toBe("skin");

    // 3. Bundles
    expect(store.bundles).not.toBeNull();
    expect(store.bundles?.endsAt).toBe(new Date(fixedMs + 172800 * 1000).toISOString());
    expect(store.bundles?.items).toHaveLength(1);
    const bundle = store.bundles!.items[0]!;
    expect(bundle.uuid).toBe("bundle-1");
    expect(bundle.name).toBe("Prime Bundle");
    expect(bundle.discountPercent).toBe(30);
    expect(bundle.items).toHaveLength(3);

    // Bundle item 1: skin
    expect(bundle.items[0]?.item.kind).toBe("skin");

    // Bundle item 2: currency
    expect(bundle.items[1]?.item.kind).toBe("currency");
    if (bundle.items[1]?.item.kind === "currency") {
      expect(bundle.items[1]?.item.amount).toBe(10);
    }

    // Bundle item 3: unknown item type -> "other"
    expect(bundle.items[2]?.item.kind).toBe("other");
    if (bundle.items[2]?.item.kind === "other") {
      expect(bundle.items[2]?.item.name).toBeNull();
      expect(bundle.items[2]?.item.typeUuid).toBe("99999999-9999-9999-9999-999999999999");
    }

    // 4. Accessories
    expect(store.accessories).not.toBeNull();
    expect(store.accessories?.endsAt).toBe(new Date(fixedMs + 43200 * 1000).toISOString());
    expect(store.accessories?.offers).toHaveLength(1);
    const accOffer = store.accessories!.offers[0]!;
    expect(accOffer.offerId).toBe("accessory-offer-1");
    expect(accOffer.contractUuid).toBe("contract-uuid-1");
    expect(accOffer.item.kind).toBe("spray");

    // 5. Radianite
    expect(store.radianite).toHaveLength(1);
    expect(store.radianite[0]?.offerId).toBe("upgrade-offer-1");
    expect(store.radianite[0]?.amount).toBe(20);
    expect(store.radianite[0]?.cost.amount).toBe(1600);
  });

  it("handles absent BonusStore and missing sections as null", () => {
    const withoutBonus: RiotStorefrontResponse = {
      ...storefrontFixture,
      BonusStore: undefined,
      UpgradeCurrencyStore: undefined,
    };

    const builder = new StoreBuilder(testPlayer, withoutBonus, catalogue, fixedMs);
    const store = builder.build();

    expect(store.nightMarket).toBeNull();
    expect(store.radianite).toEqual([]);
  });

  it("treats zero or negative duration as not running (null)", () => {
    const expiredStore: RiotStorefrontResponse = {
      SkinsPanelLayout: {
        SingleItemOffersRemainingDurationInSeconds: 0,
        SingleItemStoreOffers: storefrontFixture.SkinsPanelLayout?.SingleItemStoreOffers,
      },
      BonusStore: {
        BonusStoreRemainingDurationInSeconds: -10,
        BonusStoreOffers: storefrontFixture.BonusStore?.BonusStoreOffers,
      },
      AccessoryStore: {
        AccessoryStoreRemainingDurationInSeconds: 0,
        AccessoryStoreOffers: storefrontFixture.AccessoryStore?.AccessoryStoreOffers,
      },
      FeaturedBundle: {
        BundleRemainingDurationInSeconds: 0,
        Bundles: [
          {
            ...storefrontFixture.FeaturedBundle!.Bundles![0]!,
            DurationRemainingInSeconds: 0,
          },
        ],
      },
    };

    const builder = new StoreBuilder(testPlayer, expiredStore, catalogue, fixedMs);
    const store = builder.build();

    expect(store.daily).toBeNull();
    expect(store.nightMarket).toBeNull();
    expect(store.accessories).toBeNull();
    expect(store.bundles).toBeNull();
  });
});
