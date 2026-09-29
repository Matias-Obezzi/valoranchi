import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { LiveMatchBuilder } from "../src/collection/LiveMatchBuilder.js";
import type {
  RiotCoreGameLoadoutsResponse,
  RiotCoreGameMatchResponse,
  RiotPregameMatchResponse,
} from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

describe("LiveMatchBuilder", () => {
  const catalogue = new Catalogue(catalogueData);

  it("builds pregame match with selection states and phase timing", () => {
    const builder = new LiveMatchBuilder(catalogue);
    const pregame: RiotPregameMatchResponse = {
      ID: "pre-1",
      QueueID: "competitive",
      IsRanked: true,
      MapID: "/Game/Maps/Ascent/Ascent",
      Mode: "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
      PhaseTimeRemainingNS: 35_000_000_000,
      AllyTeam: {
        TeamID: "Blue",
        Players: [
          {
            Subject: "self-puuid",
            CharacterID: "agent-1",
            CharacterSelectionState: "locked",
            CompetitiveTier: 3,
            PlayerIdentity: {
              AccountLevel: 50,
              Incognito: false,
            },
          },
          {
            Subject: "ally-puuid",
            CharacterID: "agent-1",
            CharacterSelectionState: "selected",
            CompetitiveTier: 3,
            PlayerIdentity: {
              AccountLevel: 30,
              Incognito: true,
            },
          },
        ],
      },
      EnemyTeam: {
        TeamID: "Red",
        Players: [
          {
            Subject: "enemy-puuid",
            CharacterID: "",
            CharacterSelectionState: "",
            CompetitiveTier: 0,
          },
        ],
      },
    };

    const names = new Map([
      ["self-puuid", { gameName: "Self", tagLine: "TAG" }],
      ["ally-puuid", { gameName: "SecretAlly", tagLine: "001" }],
      ["enemy-puuid", { gameName: "Enemy", tagLine: "RED" }],
    ]);
    const ranks = new Map();

    const match = builder.buildPregame(pregame, names, ranks, "self-puuid");
    expect(match.phase).toBe("pregame");
    if (match.phase !== "pregame") return;

    expect(match.matchId).toBe("pre-1");
    expect(match.phaseEndsInMs).toBe(35000);
    expect(match.allies).toHaveLength(2);
    expect(match.enemies).toHaveLength(1);

    expect(match.allies[0]!.selection).toBe("locked");
    expect(match.allies[1]!.selection).toBe("selected");
    expect(match.allies[1]!.incognito).toBe(true);
    expect(match.allies[1]!.gameName).toBe("SecretAlly");
    expect(match.enemies[0]!.selection).toBe("none");
    expect(match.enemies[0]!.agent).toBeNull();

    expect(match.self?.puuid).toBe("self-puuid");
  });

  it("builds core game with loadout decoding and incognito names", () => {
    const builder = new LiveMatchBuilder(catalogue);
    const coreMatch: RiotCoreGameMatchResponse = {
      MatchID: "core-1",
      MapID: "/Game/Maps/Ascent/Ascent",
      ProvisioningFlow: "Matchmaking",
      MatchmakingData: {
        QueueID: "unrated",
        IsRanked: false,
      },
      Players: [
        {
          Subject: "self-puuid",
          TeamID: "Blue",
          CharacterID: "agent-1",
          PlayerIdentity: {
            AccountLevel: 50,
            Incognito: true,
          },
        },
        {
          Subject: "enemy-puuid",
          TeamID: "Red",
          CharacterID: "agent-1",
          PlayerIdentity: {
            AccountLevel: 45,
            Incognito: false,
          },
        },
      ],
    };

    const loadouts: RiotCoreGameLoadoutsResponse = {
      Loadouts: [
        {
          Loadout: {
            Subject: "self-puuid",
            Items: {
              "ee613ee3-4eb0-ab0e-0888-64939b533ee7": {
                ID: "ee613ee3-4eb0-ab0e-0888-64939b533ee7",
                Sockets: {
                  "bcef87d6-209b-46c6-8b19-fbe40bd95abc": {
                    ID: "skin-socket",
                    Item: {
                      ID: "7209796e-4f76-88c9-04fa-fb81498b5e9d",
                    },
                  },
                  "77258665-71d1-4623-bc72-44db9bd5b3b3": {
                    ID: "buddy-socket",
                    Item: {
                      ID: "bb31e51f-4cb1-6415-321d-938a9bc6a41f",
                    },
                  },
                },
              },
            },
          },
        },
      ],
    };

    const names = new Map([
      ["self-puuid", { gameName: "IncognitoSelf", tagLine: "HIDDEN" }],
      ["enemy-puuid", { gameName: "Enemy", tagLine: "TAG" }],
    ]);
    const ranks = new Map();

    const match = builder.buildCoreGame(coreMatch, loadouts, names, ranks, "self-puuid");
    expect(match.phase).toBe("ingame");
    if (match.phase !== "ingame") return;

    expect(match.allies).toHaveLength(1);
    expect(match.enemies).toHaveLength(1);
    expect(match.self?.incognito).toBe(true);
    expect(match.self?.gameName).toBe("IncognitoSelf");

    const weaponLoadout = match.self?.loadout?.[0];
    expect(weaponLoadout?.weapon.name).toBe("Vandal");
    expect(weaponLoadout?.skin?.name).toBe("Prime Vandal");
    expect(weaponLoadout?.buddy?.name).toBe("Coin Buddy");
  });

  it("detects shooting range and returns phase range", () => {
    const builder = new LiveMatchBuilder(catalogue);
    const rangeMatch: RiotCoreGameMatchResponse = {
      MatchID: "range-1",
      ProvisioningFlow: "ShootingRange",
      Players: [
        {
          Subject: "self-puuid",
          CharacterID: "agent-1",
        },
      ],
    };

    const match = builder.buildCoreGame(rangeMatch, null, new Map(), new Map(), "self-puuid");
    expect(match).toEqual({
      phase: "range",
      matchId: "range-1",
    });
  });
});
