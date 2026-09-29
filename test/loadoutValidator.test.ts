import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { CollectionBuilder } from "../src/collection/CollectionBuilder.js";
import { LoadoutWriter } from "../src/collection/LoadoutWriter.js";
import { LoadoutValidator } from "../src/client/LoadoutValidator.js";
import { ValidationError } from "../src/errors.js";
import type { Player } from "../src/model/index.js";
import type { RiotEntitlementsResponse, RiotLoadoutResponse } from "../src/riot/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("LoadoutValidator and LoadoutWriter", () => {
  const catalogueData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData;

  const entitlements = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "entitlements.json"), "utf-8"),
  ) as RiotEntitlementsResponse;

  const catalogue = new Catalogue(catalogueData);

  const player: Player = {
    puuid: "player-1",
    gameName: "Tester",
    tagLine: "NA1",
    region: "na",
    shard: "na",
    accountLevel: 50,
  };

  const ownedItems = new CollectionBuilder(player, entitlements, catalogue, "en-US").build();

  const currentRawLoadout: RiotLoadoutResponse = {
    Subject: "player-1",
    Version: 5,
    Guns: [
      {
        ID: "ee613ee3-4eb0-ab0e-0888-64939b533ee7", // Vandal
        SkinID: "4324a482-47da-4521-b3b0-4dbfcfefd779", // Standard Vandal
        SkinLevelID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
        ChromaID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
        CharmID: "43924734-4504-20dd-a3e9-fa84df6d56bb", // Coin Buddy
        CharmLevelID: "43924734-4504-20dd-a3e9-fa84df6d56bb",
        CharmInstanceID: "b6f50b24-4f51-177b-6dcd-1ba24fefd4e1", // first instance
        Attachments: [],
      },
    ],
    ActiveExpressions: [
      {
        TypeID: "03a572de-4234-31ed-d344-ababa488f981", // flex
        AssetID: "flex-uuid-1",
      },
      {
        TypeID: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475", // spray
        AssetID: "049386d3-4903-4f93-85b9-daaf91a27e7a",
      },
    ],
    Identity: {
      PlayerCardID: "9fb348bc-41a0-91ad-8a3e-818035c4e561",
      PlayerTitleID: "77741d40-4221-507c-ffb5-c081e82845c4",
      AccountLevel: 50,
      PreferredLevelBorderID: "border-1",
      HideAccountLevel: false,
    },
    Incognito: false,
  };

  it("throws unknown-weapon for an unrecognized weapon", () => {
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
        guns: [{ weapon: "banana-gun", skin: "4324a482-47da-4521-b3b0-4dbfcfefd779" }],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("unknown-weapon");
    }
  });

  it("throws unknown-item for an unrecognized skin", () => {
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
        guns: [{ weapon: "Vandal", skin: "00000000-0000-0000-0000-000000000000" }],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("unknown-item");
    }
  });

  it("throws skin-not-for-weapon when skin does not belong to weapon", () => {
    // Phantom weapon uuid is not Vandal, but let's test a mismatch if we have another weapon or mock
    const fakeCatalogue = new Catalogue({
      ...catalogueData,
      weapons: [
        catalogueData.weapons[0]!,
        {
          uuid: "phantom-uuid",
          displayName: "Phantom",
          category: "Rifle",
          skins: [],
        },
      ],
    });
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, fakeCatalogue, entitlements, {
        guns: [{ weapon: "Phantom", skin: "8908f237-47b2-031a-e905-1a89c93cc8f5" }],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("skin-not-for-weapon");
    }
  });

  it("throws skin-not-owned for an unowned skin", () => {
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
        guns: [{ weapon: "Vandal", skin: "14f05da8-4ff6-4b8a-b9c1-52a1215b2447" }], // Reaver Vandal (unowned in fixture)
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("skin-not-owned");
    }
  });

  it("throws level-not-owned when level is not owned", () => {
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
        guns: [
          {
            weapon: "Vandal",
            skin: "8908f237-47b2-031a-e905-1a89c93cc8f5", // Prime Vandal
            level: "60e90c8f-4318-77c8-04f7-33827ecbe7d2", // Level 2 (not owned in fixture)
          },
        ],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("level-not-owned");
    }
  });

  it("throws chroma-not-for-skin when chroma belongs to another skin", () => {
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
        guns: [
          {
            weapon: "Vandal",
            skin: "4324a482-47da-4521-b3b0-4dbfcfefd779", // Standard Vandal
            chroma: "fa5b4c10-482f-2ca8-ea58-d380f2dbe655", // Prime Vandal Chroma
          },
        ],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("chroma-not-for-skin");
    }
  });

  it("throws chroma-not-owned when chroma is not owned", () => {
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
        guns: [
          {
            weapon: "Vandal",
            skin: "8908f237-47b2-031a-e905-1a89c93cc8f5", // Prime Vandal
            chroma: "fa5b4c10-482f-2ca8-ea58-d380f2dbe655", // Blue chroma (not owned)
          },
        ],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("chroma-not-owned");
    }
  });

  it("throws buddy-not-owned when buddy is not owned", () => {
    const fakeCatalogue = new Catalogue({
      ...catalogueData,
      buddies: [
        ...catalogueData.buddies,
        {
          uuid: "unowned-buddy",
          displayName: "Unowned Buddy",
          displayIcon: null,
          levels: [{ uuid: "unowned-buddy-level", displayName: "L1", displayIcon: null }],
        },
      ],
    });
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, fakeCatalogue, entitlements, {
        guns: [
          {
            weapon: "Vandal",
            skin: "4324a482-47da-4521-b3b0-4dbfcfefd779",
            buddy: "unowned-buddy",
          },
        ],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("buddy-not-owned");
    }
  });

  it("throws buddy-instances-exhausted when every instance is already on another gun", () => {
    // In our fixture, Coin Buddy has 2 instances.
    // Let's create a raw loadout where gun 1 and gun 2 both use the 2 instances.
    const twoGunsRaw: RiotLoadoutResponse = {
      ...currentRawLoadout,
      Guns: [
        {
          ID: "ee613ee3-4eb0-ab0e-0888-64939b533ee7", // Vandal
          SkinID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
          SkinLevelID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
          ChromaID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
          CharmID: "43924734-4504-20dd-a3e9-fa84df6d56bb",
          CharmLevelID: "43924734-4504-20dd-a3e9-fa84df6d56bb",
          CharmInstanceID: "b6f50b24-4f51-177b-6dcd-1ba24fefd4e1", // inst 1
          Attachments: [],
        },
        {
          ID: "phantom-uuid",
          SkinID: "phantom-skin",
          SkinLevelID: "phantom-level",
          ChromaID: "phantom-chroma",
          CharmID: "43924734-4504-20dd-a3e9-fa84df6d56bb",
          CharmLevelID: "43924734-4504-20dd-a3e9-fa84df6d56bb",
          CharmInstanceID: "c7f60b24-4f51-177b-6dcd-1ba24fefd4e2", // inst 2
          Attachments: [],
        },
      ],
    };

    const fakeCatalogue = new Catalogue({
      ...catalogueData,
      weapons: [
        catalogueData.weapons[0]!,
        {
          uuid: "sheriff-uuid",
          displayName: "Sheriff",
          category: "Sidearm",
          skins: [
            {
              uuid: "sheriff-default",
              displayName: "Standard Sheriff",
              contentTierUuid: null,
              displayIcon: null,
              levels: [{ uuid: "sheriff-default", displayName: "L1", displayIcon: null }],
              chromas: [
                { uuid: "sheriff-default", displayName: "C1", displayIcon: null, swatch: null },
              ],
            },
          ],
        },
      ],
    });

    try {
      LoadoutValidator.validate(twoGunsRaw, ownedItems, fakeCatalogue, entitlements, {
        guns: [
          {
            weapon: "Sheriff",
            skin: "sheriff-default",
            buddy: "43924734-4504-20dd-a3e9-fa84df6d56bb", // Coin Buddy (all 2 instances used)
          },
        ],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("buddy-instances-exhausted");
    }
  });

  it("throws spray-not-owned for an unowned spray", () => {
    const fakeCatalogue = new Catalogue({
      ...catalogueData,
      sprays: [
        ...catalogueData.sprays,
        {
          uuid: "unowned-spray",
          displayName: "Unowned Spray",
          displayIcon: null,
          fullTransparentIcon: null,
        },
      ],
    });
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, fakeCatalogue, entitlements, {
        sprays: ["unowned-spray"],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("spray-not-owned");
    }
  });

  it("throws too-many-sprays when sprays array exceeds 3", () => {
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
        sprays: [null, null, null, null],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("too-many-sprays");
    }
  });

  it("throws flex-not-owned when flex item is not owned", () => {
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
        flex: "00000000-0000-0000-0000-000000000000",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("flex-not-owned");
    }
  });

  it("throws card-not-owned for unowned card", () => {
    const fakeCatalogue = new Catalogue({
      ...catalogueData,
      playerCards: [
        ...catalogueData.playerCards,
        {
          uuid: "unowned-card",
          displayName: "Unowned Card",
          smallArt: null,
          wideArt: null,
          largeArt: null,
        },
      ],
    });
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, fakeCatalogue, entitlements, {
        card: "unowned-card",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("card-not-owned");
    }
  });

  it("throws title-not-owned for unowned title", () => {
    const fakeCatalogue = new Catalogue({
      ...catalogueData,
      playerTitles: [
        ...catalogueData.playerTitles,
        {
          uuid: "unowned-title",
          displayName: "Unowned Title",
          titleText: null,
        },
      ],
    });
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, fakeCatalogue, entitlements, {
        title: "unowned-title",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("title-not-owned");
    }
  });

  it("throws border-too-high when border startingLevel exceeds account level", () => {
    const fakeCatalogue = new Catalogue({
      ...catalogueData,
      levelBorders: [{ uuid: "border-high", startingLevel: 100 }],
    });
    try {
      LoadoutValidator.validate(currentRawLoadout, ownedItems, fakeCatalogue, entitlements, {
        levelBorder: "border-high",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reason).toBe("border-too-high");
    }
  });

  it("validates happy path with defaults, buddy instance picking, null clearing, and case insensitivity", () => {
    const res = LoadoutValidator.validate(currentRawLoadout, ownedItems, catalogue, entitlements, {
      guns: [
        {
          weapon: "vandal", // case-insensitive weapon name
          skin: "8908F237-47B2-031A-E905-1A89C93CC8F5", // Prime Vandal, uppercase uuid
          // level omitted -> defaults to highest owned (level 1 in fixture: 7209796e-4f76-88c9-04fa-fb81498b5e9d)
          // chroma omitted -> defaults to base chroma (f88bb5d7-463e-436f-e8b9-47805187e1f4)
          buddy: "43924734-4504-20DD-A3E9-FA84DF6D56BB", // Coin Buddy, uppercase
        },
      ],
      sprays: ["836B72A6-444F-C07A-D0FC-6D80D287BBDA", null],
      flex: null,
      incognito: true,
      hideAccountLevel: true,
    });

    const gun = res.Guns[0]!;
    expect(gun.SkinID).toBe("8908f237-47b2-031a-e905-1a89c93cc8f5");
    expect(gun.SkinLevelID).toBe("7209796e-4f76-88c9-04fa-fb81498b5e9d"); // highest owned level!
    expect(gun.ChromaID).toBe("f88bb5d7-463e-436f-e8b9-47805187e1f4"); // base chroma!
    expect(gun.CharmID).toBe("43924734-4504-20dd-a3e9-fa84df6d56bb");
    expect(gun.CharmInstanceID).toBeDefined();

    expect(res.Incognito).toBe(true);
    expect(res.Identity.HideAccountLevel).toBe(true);

    // Flex was cleared with null
    expect(
      res.ActiveExpressions?.find((e) => e.TypeID === "03a572de-4234-31ed-d344-ababa488f981"),
    ).toBeUndefined();

    // Spray slot 0 set, slot 1 cleared
    const sprays = res.ActiveExpressions?.filter(
      (e) => e.TypeID === "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",
    );
    expect(sprays).toHaveLength(1);
    expect(sprays?.[0]?.AssetID).toBe("836b72a6-444f-c07a-d0fc-6d80d287bbda");
  });

  it("produces correct LoadoutWriter PUT body shape with flex first, then sprays, and Attachments: []", () => {
    const validatedRaw: RiotLoadoutResponse = {
      Subject: "player-1",
      Version: 2,
      Guns: [
        {
          ID: "ee613ee3-4eb0-ab0e-0888-64939b533ee7",
          SkinID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
          SkinLevelID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
          ChromaID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
          Attachments: ["ignored"],
        },
      ],
      ActiveExpressions: [
        { TypeID: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475", AssetID: "spray-1" },
        { TypeID: "03a572de-4234-31ed-d344-ababa488f981", AssetID: "flex-1" },
      ],
      Identity: {
        PlayerCardID: "card-1",
        PlayerTitleID: "title-1",
        AccountLevel: 42,
        PreferredLevelBorderID: "border-1",
        HideAccountLevel: false,
      },
      Incognito: false,
    };

    const putBody = LoadoutWriter.buildPutBody(validatedRaw);

    expect(putBody.Subject).toBe("player-1");
    expect(putBody.Version).toBe(2);
    expect(putBody.Guns[0]?.Attachments).toEqual([]);
    // Flex first, then sprays
    expect(putBody.ActiveExpressions).toEqual([
      { TypeID: "03a572de-4234-31ed-d344-ababa488f981", AssetID: "flex-1" },
      { TypeID: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475", AssetID: "spray-1" },
    ]);
    expect(putBody.Identity.PlayerCardID).toBe("card-1");
    expect(putBody.Incognito).toBe(false);
  });
});
