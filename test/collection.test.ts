import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { CollectionBuilder } from "../src/collection/CollectionBuilder.js";
import type { Player } from "../src/model/index.js";
import type { RiotEntitlementsResponse } from "../src/riot/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("CollectionBuilder", () => {
  const catalogueData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData;

  const entitlements = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "entitlements.json"), "utf-8"),
  ) as RiotEntitlementsResponse;

  const player: Player = {
    puuid: "test-puuid-123",
    gameName: "PlayerOne",
    tagLine: "NA1",
    region: "na",
    shard: "na",
    accountLevel: 42,
  };

  it("produces the expected OwnedItems view model from fixtures", () => {
    const catalogue = new Catalogue(catalogueData);
    const builder = new CollectionBuilder(player, entitlements, catalogue, "en-US");
    const fixedDate = new Date("2026-09-27T10:00:00.000Z");
    const result = builder.build(fixedDate);

    expect(result.player).toEqual(player);
    expect(result.language).toBe("en-US");
    expect(result.generatedAt).toBe("2026-09-27T10:00:00.000Z");

    expect(result.weapons).toHaveLength(1);
    const vandal = result.weapons[0]!;
    expect(vandal.name).toBe("Vandal");
    expect(vandal.skinsTotal).toBe(3);
    expect(vandal.skinsOwned).toBe(1);

    expect(vandal.skins).toHaveLength(1);
    const primeVandal = vandal.skins[0]!;
    expect(primeVandal.name).toBe("Prime Vandal");
    expect(primeVandal.tier?.name).toBe("Exclusive");
    expect(primeVandal.tier?.rank).toBe(5);

    expect(primeVandal.levels).toEqual([
      {
        uuid: "7209796e-4f76-88c9-04fa-fb81498b5e9d",
        name: "Prime Vandal Level 1",
        owned: true,
      },
      {
        uuid: "60e90c8f-4318-77c8-04f7-33827ecbe7d2",
        name: "Prime Vandal Level 2",
        owned: false,
      },
    ]);

    expect(primeVandal.chromas).toEqual([
      {
        uuid: "f88bb5d7-463e-436f-e8b9-47805187e1f4",
        name: "Prime Vandal",
        owned: true,
        swatch:
          "https://media.valorant-api.com/weaponskinchromas/f88bb5d7-463e-436f-e8b9-47805187e1f4/swatch.png",
      },
      {
        uuid: "d348a609-4458-7e3e-7a91-db9b01053805",
        name: "Prime Vandal (Orange)",
        owned: true,
        swatch:
          "https://media.valorant-api.com/weaponskinchromas/d348a609-4458-7e3e-7a91-db9b01053805/swatch.png",
      },
      {
        uuid: "fa5b4c10-482f-2ca8-ea58-d380f2dbe655",
        name: "Prime Vandal (Blue)",
        owned: false,
        swatch:
          "https://media.valorant-api.com/weaponskinchromas/fa5b4c10-482f-2ca8-ea58-d380f2dbe655/swatch.png",
      },
    ]);

    expect(result.buddies).toEqual([
      {
        uuid: "43924734-4504-20dd-a3e9-fa84df6d56bb",
        name: "Coin Buddy",
        icon: "https://media.valorant-api.com/buddies/coin.png",
        instances: 2,
      },
    ]);

    expect(result.agents).toEqual([
      {
        uuid: "add6443a-41bd-e414-f6ad-e58d267f4e95",
        name: "Jett",
        role: "Duelist",
        icon: "https://media.valorant-api.com/agents/jett.png",
      },
    ]);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]!.name).toBe("Duelist Card");

    expect(result.titles).toHaveLength(1);
    expect(result.titles[0]!.text).toBe("Champion");

    expect(result.sprays).toHaveLength(1);
    expect(result.sprays[0]!.name).toBe("GG Spray");
  });

  it("builds loadout from ActiveExpressions including flex and sprays", async () => {
    const { LoadoutBuilder } = await import("../src/collection/LoadoutBuilder.js");
    const catalogue = new Catalogue(catalogueData);
    const raw = {
      Subject: player.puuid,
      Version: 1,
      Guns: [],
      ActiveExpressions: [
        { TypeID: "03a572de-4234-31ed-d344-ababa488f981", AssetID: "flex-uuid-1" },
        { TypeID: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475", AssetID: "049386d3-4903-4f93-85b9-daaf91a27e7a" },
      ],
      Identity: {
        PlayerCardID: "card-uuid",
        PlayerTitleID: "title-uuid",
        AccountLevel: 50,
        HideAccountLevel: false,
      },
      Incognito: false,
    };
    const builder = new LoadoutBuilder(player, raw, catalogue);
    const loadout = builder.build();

    expect(loadout.flex).toEqual({
      uuid: "flex-uuid-1",
      name: "Flex",
      icon: null,
    });
    expect(loadout.sprays).toHaveLength(1);
    expect(loadout.sprays[0]?.slot).toBe("0");
    expect(loadout.sprays[0]?.uuid).toBe("049386d3-4903-4f93-85b9-daaf91a27e7a");
  });
});
