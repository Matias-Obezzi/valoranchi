import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import { decodeValorantPresence } from "../src/local/Presence.js";

const sampleCatalogueData = {
  weapons: [],
  playerCards: [
    {
      uuid: "card-1",
      displayName: "Card One",
      smallArt: "card-1-sm",
      wideArt: null,
      largeArt: null,
    },
  ],
  playerTitles: [{ uuid: "title-1", displayName: "Title One", titleText: "Text One" }],
  sprays: [],
  buddies: [],
  agents: [],
  contentTiers: [],
  currencies: [],
  bundles: [],
};

describe("decodeValorantPresence", () => {
  it("decodes flat presence keys and resolves card and title when catalogue is present", () => {
    const raw = {
      sessionLoopState: "MENUS",
      partyId: "party-123",
      partySize: 2,
      maxPartySize: 5,
      isPartyOwner: true,
      queueId: "unrated",
      matchMap: "/Game/Maps/Ascent/Ascent",
      competitiveTier: 15,
      leaderboardPosition: 120,
      accountLevel: 75,
      playerCardId: "card-1",
      playerTitleId: "title-1",
      partyOwnerMatchScoreAllyTeam: 5,
      partyOwnerMatchScoreEnemyTeam: 3,
    };
    const b64 = Buffer.from(JSON.stringify(raw)).toString("base64");
    const catalogue = new Catalogue(sampleCatalogueData);

    const result = decodeValorantPresence(b64, catalogue);
    expect(result).toEqual({
      state: "menus",
      queue: "unrated",
      map: "/Game/Maps/Ascent/Ascent",
      party: {
        id: "party-123",
        size: 2,
        max: 5,
        owner: true,
      },
      competitiveTier: 15,
      leaderboardPosition: 120,
      accountLevel: 75,
      card: {
        uuid: "card-1",
        name: "Card One",
        small: "card-1-sm",
      },
      title: {
        uuid: "title-1",
        name: "Title One",
        text: "Text One",
      },
      score: { ally: 5, enemy: 3 },
    });
  });

  it("decodes nested presence keys", () => {
    const raw = {
      matchPresenceData: {
        sessionLoopState: "INGAME",
        queueId: "competitive",
        matchMap: "/Game/Maps/Bonsai/Bonsai",
      },
      partyPresenceData: {
        partyId: "party-nested",
        partySize: 3,
        maxPartySize: 5,
        isPartyOwner: false,
        partyOwnerMatchScoreAllyTeam: 13,
        partyOwnerMatchScoreEnemyTeam: 11,
      },
      playerPresenceData: {
        competitiveTier: 20,
        leaderboardPosition: 10,
        accountLevel: 150,
        playerCardId: "card-unknown",
        playerTitleId: "title-unknown",
      },
    };
    const b64 = Buffer.from(JSON.stringify(raw)).toString("base64");

    const result = decodeValorantPresence(b64);
    expect(result).toEqual({
      state: "ingame",
      queue: "competitive",
      map: "/Game/Maps/Bonsai/Bonsai",
      party: {
        id: "party-nested",
        size: 3,
        max: 5,
        owner: false,
      },
      competitiveTier: 20,
      leaderboardPosition: 10,
      accountLevel: 150,
      card: {
        uuid: "card-unknown",
        name: "",
        small: null,
      },
      title: {
        uuid: "title-unknown",
        name: "",
        text: null,
      },
      score: { ally: 13, enemy: 11 },
    });
  });

  it("prefers flat keys over nested keys", () => {
    const raw = {
      sessionLoopState: "PREGAME",
      matchPresenceData: {
        sessionLoopState: "INGAME",
      },
      partyId: "flat-party",
      partyPresenceData: {
        partyId: "nested-party",
      },
    };
    const b64 = Buffer.from(JSON.stringify(raw)).toString("base64");

    const result = decodeValorantPresence(b64);
    expect(result?.state).toBe("pregame");
    expect(result?.party.id).toBe("flat-party");
  });

  it("returns null for garbage, empty or non-string input", () => {
    expect(decodeValorantPresence(null)).toBeNull();
    expect(decodeValorantPresence(undefined)).toBeNull();
    expect(decodeValorantPresence("")).toBeNull();
    expect(decodeValorantPresence("not-valid-base64-json@@@")).toBeNull();
    expect(decodeValorantPresence(Buffer.from("not json").toString("base64"))).toBeNull();
  });
});
