import { describe, expect, it, vi } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import { MemoryCatalogueCache, ValorantApi } from "../src/catalogue/ValorantApi.js";
import type { HttpGateway } from "../src/riot/HttpGateway.js";

const sampleData = {
  weapons: [
    {
      uuid: "weapon-1",
      displayName: "Vandal",
      category: "EEquippableCategory::Rifle",
      shopData: { categoryText: "Rifles" },
      skins: [
        {
          uuid: "skin-1",
          displayName: "Prime Vandal",
          contentTierUuid: "tier-1",
          displayIcon: "icon-prime",
          levels: [
            { uuid: "level-1", displayName: "Prime Vandal Level 1", displayIcon: "icon-l1" },
            { uuid: "level-2", displayName: "Prime Vandal Level 2", displayIcon: "icon-l2" },
          ],
          chromas: [
            {
              uuid: "chroma-1",
              displayName: "Prime Vandal",
              displayIcon: "icon-c1",
              swatch: "swatch-1",
            },
            {
              uuid: "chroma-2",
              displayName: "Prime Vandal (Orange)",
              displayIcon: "icon-c2",
              swatch: "swatch-2",
            },
          ],
        },
      ],
    },
  ],
  playerCards: [
    { uuid: "card-1", displayName: "Duelist Card", smallArt: "sm", wideArt: "wd", largeArt: "lg" },
  ],
  playerTitles: [{ uuid: "title-1", displayName: "Champion", titleText: "Champion" }],
  sprays: [
    {
      uuid: "spray-1",
      displayName: "GG Spray",
      displayIcon: "gg-icon",
      fullTransparentIcon: "gg-full",
    },
  ],
  buddies: [
    {
      uuid: "buddy-1",
      displayName: "Coin Buddy",
      displayIcon: "coin-icon",
      levels: [
        { uuid: "buddy-level-1", displayName: "Coin Buddy Level 1", displayIcon: "coin-icon" },
      ],
    },
  ],
  agents: [
    {
      uuid: "agent-1",
      displayName: "Jett",
      role: { displayName: "Duelist" },
      displayIcon: "jett-icon",
      isPlayableCharacter: true,
    },
  ],
  contentTiers: [
    { uuid: "tier-1", displayName: "Exclusive", rank: 5, displayIcon: "exclusive-icon" },
  ],
  currencies: [{ uuid: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741", displayName: "Valorant Points" }],
  bundles: [
    {
      uuid: "bundle-1",
      displayName: "Prime Bundle",
      displayNameSubText: "Prime // 1.0",
      description: "Prime collection",
      displayIcon: "icon-bundle",
      displayIcon2: "icon-bundle-2",
      verticalPromoImage: "promo-bundle",
    },
  ],
};

describe("Catalogue", () => {
  it("indexes entities and resolves lookups in O(1)", () => {
    const catalogue = new Catalogue(sampleData);

    expect(catalogue.getWeapon("weapon-1")?.displayName).toBe("Vandal");
    expect(catalogue.getSkin("skin-1")?.displayName).toBe("Prime Vandal");
    expect(catalogue.findSkinAndWeaponByLevel("level-2")?.weapon.displayName).toBe("Vandal");
    expect(catalogue.findSkinAndWeaponByChroma("chroma-2")?.chroma.displayName).toBe(
      "Prime Vandal (Orange)",
    );
    expect(catalogue.findBuddyByLevel("buddy-level-1")?.buddy.displayName).toBe("Coin Buddy");
    expect(catalogue.getCard("card-1")?.displayName).toBe("Duelist Card");
    expect(catalogue.getTitle("title-1")?.titleText).toBe("Champion");
    expect(catalogue.getSpray("spray-1")?.displayName).toBe("GG Spray");
    expect(catalogue.getAgent("agent-1")?.displayName).toBe("Jett");
    expect(catalogue.getTier("tier-1")?.displayName).toBe("Exclusive");
    expect(catalogue.getBundle("bundle-1")?.displayName).toBe("Prime Bundle");
  });
});

describe("ValorantApi", () => {
  it("fetches client version and caches it", async () => {
    const mockGet = vi.fn().mockResolvedValue({
      status: 200,
      data: { riotClientVersion: "release-09.00-12345" },
    });
    const fakeGateway = { get: mockGet } as unknown as HttpGateway;
    const cache = new MemoryCatalogueCache();
    const api = new ValorantApi(fakeGateway, cache);

    const v1 = await api.getClientVersion();
    const v2 = await api.getClientVersion();

    expect(v1).toBe("release-09.00-12345");
    expect(v2).toBe("release-09.00-12345");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("fetches catalogue endpoints and caches per language", async () => {
    const mockGet = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("weapons")) return { status: 200, data: sampleData.weapons };
      if (url.includes("playerCards")) return { status: 200, data: sampleData.playerCards };
      if (url.includes("playerTitles")) return { status: 200, data: sampleData.playerTitles };
      if (url.includes("sprays")) return { status: 200, data: sampleData.sprays };
      if (url.includes("buddies")) return { status: 200, data: sampleData.buddies };
      if (url.includes("agents")) return { status: 200, data: sampleData.agents };
      if (url.includes("contentTiers")) return { status: 200, data: sampleData.contentTiers };
      if (url.includes("currencies")) return { status: 200, data: sampleData.currencies };
      if (url.includes("bundles")) return { status: 200, data: sampleData.bundles };
      throw new Error(`Unexpected url: ${url}`);
    });

    const fakeGateway = { get: mockGet } as unknown as HttpGateway;
    const cache = new MemoryCatalogueCache();
    const api = new ValorantApi(fakeGateway, cache);

    const cat1 = await api.getCatalogue("en-US");
    const cat2 = await api.getCatalogue("en-US");

    expect(cat1.getWeapon("weapon-1")?.displayName).toBe("Vandal");
    expect(cat1.getBundle("bundle-1")?.displayName).toBe("Prime Bundle");
    expect(cat2).toBe(cat1);
    expect(mockGet).toHaveBeenCalledTimes(9);
  });
});
