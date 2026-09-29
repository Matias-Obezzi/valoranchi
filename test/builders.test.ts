import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { AccountProgressionBuilder } from "../src/collection/AccountProgressionBuilder.js";
import { ContentBuilder } from "../src/collection/ContentBuilder.js";
import { GameSessionBuilder } from "../src/collection/GameSessionBuilder.js";
import { CustomGameConfigsBuilder } from "../src/collection/CustomGameConfigsBuilder.js";
import { LeaderboardBuilder } from "../src/collection/LeaderboardBuilder.js";
import { PlayerSettingsBuilder } from "../src/collection/PlayerSettingsBuilder.js";
import { QueueConfigBuilder } from "../src/collection/QueueConfigBuilder.js";
import { StoreOffersBuilder } from "../src/collection/StoreOffersBuilder.js";
import type {
  RiotAccountXpResponse,
  RiotContentResponse,
  RiotContractsResponse,
  RiotFavoritesResponse,
  RiotLeaderboardResponse,
  RiotOffersResponse,
  RiotOrderResponse,
  RiotPenaltiesResponse,
  RiotQueueConfigsResponse,
  RiotSessionResponse,
} from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;
const catalogue = new Catalogue(catalogueData);

describe("AccountProgressionBuilder", () => {
  it("builds account XP progression and history", () => {
    const raw: RiotAccountXpResponse = {
      Progress: { Level: 42, XP: 1500 },
      History: [
        {
          ID: "match-1",
          MatchStart: "2026-09-29T10:00:00Z",
          StartProgress: { Level: 42, XP: 500 },
          EndProgress: { Level: 42, XP: 1500 },
          XPDelta: 1000,
          XPSources: [
            { ID: "time-played", Amount: 500 },
            { ID: "match-win", Amount: 300 },
            { ID: "first-win-of-the-day", Amount: 200 },
          ],
        },
      ],
      NextTimeFirstWinAvailable: "2026-09-30T10:00:00Z",
    };

    const xp = AccountProgressionBuilder.buildAccountXp(raw);
    expect(xp.level).toBe(42);
    expect(xp.xp).toBe(1500);
    expect(xp.history).toHaveLength(1);
    expect(xp.history[0]?.sources.timePlayed).toBe(500);
    expect(xp.history[0]?.sources.matchWin).toBe(300);
    expect(xp.history[0]?.sources.firstWinOfTheDay).toBe(200);
    expect(xp.nextFirstWinAt).toBe("2026-09-30T10:00:00Z");
  });

  it("builds contract progress and rewards", () => {
    const raw: RiotContractsResponse = {
      Contracts: [
        {
          ContractDefinitionID: "contract-jett-1",
          ProgressionLevelReached: 1,
          ProgressionTowardsNextLevel: 5000,
        },
      ],
      ActiveSpecialContract: "contract-jett-1",
      Missions: [
        {
          ID: "mission-weekly-1",
          Objectives: { "objective-1": 4 },
          Complete: false,
          ExpirationTime: "2026-10-01T00:00:00Z",
        },
      ],
    };

    const contracts = AccountProgressionBuilder.buildContracts(raw, catalogue);
    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.name).toBe("Jett Gear");
    expect(contracts[0]?.kind).toBe("agent");
    expect(contracts[0]?.active).toBe(true);
    expect(contracts[0]?.level).toBe(1);
    expect(contracts[0]?.progress).toBe(5000);
    expect(contracts[0]?.rewards[0]?.unlocked).toBe(true);
    expect(contracts[0]?.rewards[1]?.unlocked).toBe(false);
    expect(contracts[0]?.nextLevelAt).toBe(30000);

    const missions = AccountProgressionBuilder.buildMissions(raw, catalogue);
    expect(missions).toHaveLength(1);
    expect(missions[0]?.title).toBe("Play 10 games");
    expect(missions[0]?.progress).toBe(4);
    expect(missions[0]?.target).toBe(10);
    expect(missions[0]?.complete).toBe(false);
  });

  it("builds penalties and favourites", () => {
    const penaltiesRaw: RiotPenaltiesResponse = {
      Penalties: [{ ID: "pen-1", Reason: "AFK", Expiry: "2026-10-01T00:00:00Z" }],
    };
    const penalties = AccountProgressionBuilder.buildPenalties(penaltiesRaw);
    expect(penalties).toHaveLength(1);
    expect(penalties[0]?.reason).toBe("AFK");

    const favsRaw: RiotFavoritesResponse = {
      FavoritedContent: {
        item1: { FavoriteID: "fav-1", ItemID: "4324a482-47da-4521-b3b0-4dbfcfefd779" },
      },
    };
    const favourites = AccountProgressionBuilder.buildFavourites(favsRaw, catalogue);
    expect(favourites).toHaveLength(1);
    expect(favourites[0]?.name).toBe("Standard Vandal");
    expect(favourites[0]?.weapon).toBe("Vandal");
  });
});

describe("StoreOffersBuilder", () => {
  it("builds offers and orders", () => {
    const builder = new StoreOffersBuilder(catalogue);
    const rawOffers: RiotOffersResponse = {
      Offers: [
        {
          OfferID: "offer-1",
          StartDate: "2026-09-29T00:00:00Z",
          Cost: { "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741": 1775 },
          Rewards: [
            {
              ItemTypeID: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",
              ItemID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
              Quantity: 1,
            },
          ],
        },
      ],
    };

    const offers = builder.buildOffers(rawOffers);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.id).toBe("offer-1");
    expect(offers[0]?.cost.amount).toBe(1775);

    const rawOrder: RiotOrderResponse = {
      id: "ord-1",
      status: "complete",
      ItemID: "4324a482-47da-4521-b3b0-4dbfcfefd779",
      ItemTypeID: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",
      Cost: { "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741": 1775 },
    };
    const order = builder.buildOrder(rawOrder);
    expect(order.id).toBe("ord-1");
    expect(order.cost?.amount).toBe(1775);
  });
});

describe("LeaderboardBuilder", () => {
  it("builds competitive leaderboard", () => {
    const builder = new LeaderboardBuilder(catalogue);
    const raw: RiotLeaderboardResponse = {
      SeasonID: "season-act-1",
      QueueID: "competitive",
      totalPlayers: 1,
      startIndex: 0,
      query: "",
      Players: [
        {
          leaderboardRank: 1,
          puuid: "player-1",
          gameName: "Pro",
          tagLine: "NA1",
          IsAnonymized: false,
          IsBanned: false,
          rankedRating: 500,
          numberOfWins: 50,
          competitiveTier: 3,
        },
      ],
      tierDetails: {
        "3": { rankedRatingThreshold: 100, startingPage: 1, startingIndex: 0 },
      },
    };

    const lb = builder.build(raw);
    expect(lb.season).toBe("season-act-1");
    expect(lb.total).toBe(1);
    expect(lb.entries[0]?.gameName).toBe("Pro");
    expect(lb.entries[0]?.tier.name).toBe("Iron 3");
    expect(lb.tierThresholds["3"]).toBe(100);
  });
});

describe("ContentBuilder, QueueConfigBuilder, GameSessionBuilder", () => {
  it("builds content details", () => {
    const raw: RiotContentResponse = {
      Seasons: [
        {
          ID: "act-1",
          Name: "Act 1",
          Type: "act",
          StartTime: "2026-01-01T00:00:00Z",
          EndTime: "2026-06-01T00:00:00Z",
          IsActive: true,
        },
      ],
      Events: [
        {
          ID: "event-1",
          Name: "Lunar New Year",
          StartTime: "2026-01-01T00:00:00Z",
          EndTime: "2026-02-01T00:00:00Z",
          IsActive: true,
        },
      ],
    };

    const content = ContentBuilder.build(raw);
    expect(content.act?.name).toBe("Act 1");
    expect(content.episode).toBeNull();
    expect(content.events).toHaveLength(1);
  });

  it("builds queue configs", () => {
    const raw: RiotQueueConfigsResponse = {
      Queues: [
        {
          QueueID: "competitive",
          Enabled: true,
          IsRanked: true,
          TeamSize: 5,
          NumTeams: 2,
          MinPartySize: 1,
          MaxPartySize: 5,
          Mode: "bomb",
        },
      ],
    };

    const queues = QueueConfigBuilder.build(raw);
    expect(queues).toHaveLength(1);
    expect(queues[0]?.id).toBe("competitive");
    expect(queues[0]?.ranked).toBe(true);
  });

  it("builds game session", () => {
    const raw: RiotSessionResponse = {
      subject: "me",
      clientVersion: "release-10.00",
      loopState: "MENUS",
      playtimeMinutes: 120,
      isRestricted: false,
    };

    const session = GameSessionBuilder.build(raw);
    expect(session.state).toBe("menus");
    expect(session.clientVersion).toBe("release-10.00");
    expect(session.playtimeMinutes).toBe(120);
    expect(session.restricted).toBe(false);
  });

  it("builds player settings decoding keybinds and mouse settings", () => {
    const rawData = {
      actionMappings: [
        {
          actionName: "Movement_Forward",
          characterName: "None",
          key: "W",
          alt: false,
          ctrl: false,
          shift: false,
          cmd: false,
          bInvert: false,
        },
        {
          actionName: "Ability_Primary",
          characterName: "Jett",
          key: "E",
          alt: false,
          ctrl: false,
          shift: true,
          cmd: false,
          bInvert: false,
        },
      ],
      floatSettings: [
        { settingEnum: "EAresFloatSettingName::MouseSensitivity", value: 0.35 },
        { settingEnum: "EAresFloatSettingName::MouseSensitivityTargetingMultiplier", value: 0.8 },
      ],
      boolSettings: [
        { settingEnum: "EAresBoolSettingName::InvertMouse", value: false },
        { settingEnum: "EAresBoolSettingName::RawInputBuffer", value: true },
      ],
      roamingSetttingsVersion: 10,
    };

    const settings = PlayerSettingsBuilder.build(rawData);
    expect(settings.binds).toHaveLength(2);
    expect(settings.binds[0]).toEqual({
      command: "Movement_Forward",
      key: "W",
      alt: false,
      ctrl: false,
      shift: false,
      agent: null,
      slot: 0,
    });
    expect(settings.binds[1]).toEqual({
      command: "Ability_Primary",
      key: "E",
      alt: false,
      ctrl: false,
      shift: true,
      agent: "Jett",
      slot: 0,
    });
    expect(settings.mouse.sensitivity).toBe(0.35);
    expect(settings.mouse.scopedSensitivityMultiplier).toBe(0.8);
    expect(settings.mouse.invertY).toBe(false);
    expect(settings.mouse.rawInputBuffer).toBe(true);
    expect(settings.raw).toBe(rawData);
  });

  it("builds custom game configs resolving maps, modes and server pings", () => {
    const rawConfigs = {
      EnabledMaps: ["/Game/Maps/Ascent/Ascent", "/Game/Maps/Bonsai/Bonsai"],
      EnabledModes: [
        "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
        "/Game/GameModes/Deathmatch/DeathmatchGameMode.DeathmatchGameMode_C",
      ],
      GamePodPingServiceInfo: {
        "aresriot.aws-rso-pdx1.us-west-2": {
          SecurityHash: 123,
          PingProxyAddress: "1.2.3.4:5678",
        },
        "aresriot.aws-rso-sjc1.us-west-1": {
          SecurityHash: 456,
          PingProxyAddress: "5.6.7.8:1234",
        },
      },
    };
    const pingMap = {
      "aresriot.aws-rso-pdx1.us-west-2": 24,
      "aresriot.aws-rso-sjc1.us-west-1": 15,
    };

    const configs = CustomGameConfigsBuilder.build(rawConfigs as never, catalogue, pingMap);
    expect(configs.maps).toHaveLength(2);
    expect(configs.maps[0]?.name).toBe("Ascent");
    expect(configs.modes).toHaveLength(2);
    expect(configs.modes[0]?.name).toBe("Standard");
    expect(configs.modes[1]?.name).toBe("Deathmatch");
    expect(configs.servers).toHaveLength(2);
    const pdx = configs.servers.find((s) => s.id.includes("pdx"));
    expect(pdx?.ping).toBe(24);
  });
});
