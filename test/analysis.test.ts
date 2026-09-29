import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ratingTrend } from "../src/analysis/ratingTrend.js";
import { performanceSummary } from "../src/analysis/performanceSummary.js";
import { playerAssessment } from "../src/analysis/playerAssessment.js";
import { diffLoadout, exportLoadout } from "../src/analysis/loadoutDiff.js";
import { MatchBuilder } from "../src/collection/MatchBuilder.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { RankResolver } from "../src/collection/RankResolver.js";
import type { Loadout, Mmr } from "../src/model/index.js";
import type { LoadoutChange } from "../src/client/LoadoutValidator.js";
import type { RiotCompetitiveUpdate, RiotMatchDetailsResponse } from "../src/riot/types.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;
const catalogue = new Catalogue(catalogueData);
const resolver = new RankResolver(catalogue);

const twentyUpdates = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "fixtures", "analysis", "twentyUpdates.json"),
    "utf-8",
  ),
) as RiotCompetitiveUpdate[];

describe("ratingTrend", () => {
  it("computes all trend fields from twenty competitive updates", () => {
    const currentRank = resolver.fromTier(15, 72);
    const trend = ratingTrend(twentyUpdates, currentRank);

    expect(trend.streak).toEqual({
      kind: "win",
      length: 5,
    });

    expect(trend.net).toEqual({
      last5: 105,
      last10: 101,
      last20: 120,
    });

    expect(trend.winRate).toBe(0.6);
    expect(trend.perGame.averageGain).toBe(21.1);
    expect(trend.perGame.averageLoss).toBe(16.6);

    expect(trend.toNextRank).toEqual({
      rating: 28,
      winsAtCurrentPace: 2,
    });

    expect(trend.toDemotion).toEqual({
      rating: 72,
      lossesAtCurrentPace: 5,
    });

    expect(trend.pace).toBe("climbing");
  });

  it("handles empty updates gracefully", () => {
    const trend = ratingTrend([]);
    expect(trend.streak).toEqual({ kind: null, length: 0 });
    expect(trend.net).toEqual({ last5: 0, last10: 0, last20: 0 });
    expect(trend.winRate).toBe(0);
    expect(trend.perGame).toEqual({ averageGain: null, averageLoss: null });
    expect(trend.toNextRank).toEqual({ rating: 100, winsAtCurrentPace: null });
    expect(trend.toDemotion).toEqual({ rating: 0, lossesAtCurrentPace: null });
    expect(trend.pace).toBe("holding");
  });

  it("identifies falling pace when net last 10 is negative", () => {
    const lossUpdates: RiotCompetitiveUpdate[] = Array.from({ length: 10 }, (_, i) => ({
      MatchID: `m-${i}`,
      MapID: "",
      SeasonID: "",
      MatchStartTime: 1000 - i,
      TierAfterUpdate: 15,
      TierBeforeUpdate: 15,
      RankedRatingAfterUpdate: 20,
      RankedRatingBeforeUpdate: 38,
      RankedRatingEarned: -18,
      RankedRatingPerformanceBonus: 0,
      CompetitiveMovement: "MOVEMENT_DOWN",
      AFKPenalty: 0,
    }));
    const trend = ratingTrend(lossUpdates, resolver.fromTier(15, 20));
    expect(trend.streak).toEqual({ kind: "loss", length: 10 });
    expect(trend.pace).toBe("falling");
    expect(trend.toDemotion.lossesAtCurrentPace).toBe(2);
  });
});

const rawThreeMatches = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, "fixtures", "analysis", "threeMatchDetails.json"),
    "utf-8",
  ),
) as RiotMatchDetailsResponse[];

describe("performanceSummary", () => {
  const matches = rawThreeMatches.map((m) =>
    new MatchBuilder(m, catalogue, "self-puuid").build(),
  );

  it("computes overall performance statistics and consistency", () => {
    const summary = performanceSummary(matches, "self-puuid", catalogue);

    expect(summary.overall).toEqual({
      games: 3,
      wins: 2,
      winRate: 0.67,
      kd: 1.05,
      kda: 1.49,
      headshotRate: 0.35,
      averageScore: 3000,
      averageDamagePerRound: 123.3,
      firstBloodsPerGame: 0.3,
      plantsPerGame: 0.7,
      defusesPerGame: 0.3,
    });

    expect(summary.consistency).toEqual({
      scoreStdDev: 816.5,
      gamesNonNegative: 2,
      longestNonNegativeStreak: 2,
    });
  });

  it("computes breakdown by agent and by map", () => {
    const summary = performanceSummary(matches, "self-puuid", catalogue);

    expect(summary.byAgent).toHaveLength(2);
    const jett = summary.byAgent.find((a) => a.name === "Jett");
    expect(jett).toBeDefined();
    expect(jett?.games).toBe(2);
    expect(jett?.wins).toBe(2);
    expect(jett?.winRate).toBe(1);
    expect(jett?.kd).toBe(1.4);

    expect(summary.byMap).toHaveLength(2);
    const ascent = summary.byMap.find((m) => m.name === "Ascent");
    expect(ascent).toBeDefined();
    expect(ascent?.games).toBe(2);
    expect(ascent?.wins).toBe(2);
    expect(ascent?.winRate).toBe(1);
  });

  it("returns null best and worst when fewer than 3 games per agent or map", () => {
    const summary = performanceSummary(matches, "self-puuid", catalogue);
    expect(summary.best.agent).toBeNull();
    expect(summary.worst.agent).toBeNull();
    expect(summary.best.map).toBeNull();
    expect(summary.worst.map).toBeNull();
  });

  it("selects best and worst agent and map with the minimum-3-games rule", () => {
    const match4 = new MatchBuilder(
      {
        ...rawThreeMatches[0]!,
        matchInfo: { ...rawThreeMatches[0]!.matchInfo, matchId: "match-3" },
      },
      catalogue,
      "self-puuid",
    ).build();

    const match5 = new MatchBuilder(
      {
        ...rawThreeMatches[2]!,
        matchInfo: { ...rawThreeMatches[2]!.matchInfo, matchId: "match-4" },
      },
      catalogue,
      "self-puuid",
    ).build();

    const match6 = new MatchBuilder(
      {
        ...rawThreeMatches[2]!,
        matchInfo: { ...rawThreeMatches[2]!.matchInfo, matchId: "match-5" },
      },
      catalogue,
      "self-puuid",
    ).build();

    const expandedMatches = [...matches, match4, match5, match6];
    const summary = performanceSummary(expandedMatches, "self-puuid", catalogue);

    expect(summary.best.agent?.name).toBe("Jett");
    expect(summary.worst.agent?.name).toBe("Phoenix");
    expect(summary.best.map?.name).toBe("Ascent");
    expect(summary.worst.map?.name).toBe("Bind");
  });
});

function createMockMmr(overrides?: Partial<Mmr>): Mmr {
  return {
    current: null,
    fit: {
      verdict: null,
      ranksAbove: 0,
      expected: null,
      averageGain: null,
      averageLoss: null,
      sample: 0,
    },
    peak: null,
    act: null,
    lastUpdate: null,
    leaderboardAnonymized: false,
    ...overrides,
  };
}

describe("playerAssessment", () => {
  it("flags low-level-high-rank when account level is under 50 and tier is Platinum or higher", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(15, 50),
      fit: { verdict: "fit", ranksAbove: 0, expected: null, averageGain: 20, averageLoss: 15, sample: 5 },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 5, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 30,
      mmr,
      updates: [],
    });

    expect(assessment.warnings).toContain("low-level-high-rank");
    expect(assessment.flags.find((f) => f.flag === "low-level-high-rank")?.reason).toContain(
      "Account level 30 under 50 with Platinum or higher rank",
    );
  });

  it("flags inflated when rank fit verdict is above", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: { verdict: "above", ranksAbove: -1, expected: null, averageGain: 10, averageLoss: 20, sample: 5 },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 5, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 60,
      mmr,
      updates: [],
    });

    expect(assessment.warnings).toContain("inflated");
  });

  it("flags underranked when rank fit is below with two ranks", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: { verdict: "below", ranksAbove: 2, expected: null, averageGain: 35, averageLoss: 10, sample: 5 },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 8, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 60,
      mmr,
      updates: [],
    });

    expect(assessment.warnings).toContain("underranked");
  });

  it("flags long-streak when streak is 5 or more", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: { verdict: "fit", ranksAbove: 0, expected: null, averageGain: 20, averageLoss: 15, sample: 5 },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 5, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 60,
      mmr,
      updates: twentyUpdates,
    });

    expect(assessment.warnings).toContain("long-streak");
    expect(assessment.flags.find((f) => f.flag === "long-streak")?.reason).toBe(
      "5-game win streak",
    );
  });

  it("flags new-act when fewer than 5 games this act", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: { verdict: "fit", ranksAbove: 0, expected: null, averageGain: 20, averageLoss: 15, sample: 3 },
      act: { uuid: "act-1", name: "Act 1", games: 3, wins: 2, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 60,
      mmr,
      updates: [],
    });

    expect(assessment.warnings).toContain("new-act");
    expect(assessment.flags.find((f) => f.flag === "new-act")?.reason).toContain(
      "Fewer than 5 competitive games played this act (3)",
    );
  });

  it("returns no flags for normal accounts", () => {
    const mmr = createMockMmr({
      current: resolver.fromTier(12, 50),
      fit: { verdict: "fit", ranksAbove: 0, expected: null, averageGain: 20, averageLoss: 15, sample: 5 },
      act: { uuid: "act-1", name: "Act 1", games: 10, wins: 5, gamesNeededForRating: 0 },
    });
    const assessment = playerAssessment({
      puuid: "p1",
      accountLevel: 80,
      mmr,
      updates: [],
    });

    expect(assessment.flags).toHaveLength(0);
    expect(assessment.warnings).toHaveLength(0);
  });
});

function createTestLoadout(): Loadout {
  const vandal = catalogue.weapons.find((w) => w.displayName === "Vandal")!;
  const primeSkin = vandal.skins.find((s) => s.displayName === "Prime Vandal")!;

  return {
    player: {
      puuid: "p1",
      gameName: "Player",
      tagLine: "1234",
      region: "na",
      shard: "na",
      accountLevel: 50,
    },
    guns: [
      {
        weapon: { uuid: vandal.uuid, name: vandal.displayName },
        skin: { uuid: primeSkin.uuid, name: primeSkin.displayName, icon: primeSkin.displayIcon ?? null },
        level: { uuid: primeSkin.levels[0]!.uuid, name: primeSkin.levels[0]!.displayName },
        chroma: { uuid: primeSkin.chromas[0]!.uuid, name: primeSkin.chromas[0]!.displayName },
        buddy: null,
      },
    ],
    sprays: [
      {
        slot: "0",
        uuid: catalogueData.sprays[0]!.uuid,
        name: catalogueData.sprays[0]!.displayName,
        icon: catalogueData.sprays[0]!.displayIcon ?? null,
      },
    ],
    flex: null,
    card: {
      uuid: catalogueData.playerCards[0]!.uuid,
      name: catalogueData.playerCards[0]!.displayName,
      small: catalogueData.playerCards[0]!.smallArt,
      wide: catalogueData.playerCards[0]!.wideArt,
      large: catalogueData.playerCards[0]!.largeArt,
    },
    title: {
      uuid: catalogueData.playerTitles[0]!.uuid,
      name: catalogueData.playerTitles[0]!.displayName,
      text: catalogueData.playerTitles[0]!.titleText,
    },
    incognito: false,
  };
}

describe("loadoutDiff and exportLoadout", () => {
  it("diffLoadout with identical loadouts produces 0 changes", () => {
    const current = createTestLoadout();
    const diff = diffLoadout(current, current, catalogue);
    expect(diff.totalChanges).toBe(0);
    expect(diff.guns).toHaveLength(0);
    expect(diff.sprays).toHaveLength(0);
    expect(diff.identity).toHaveLength(0);
  });

  it("diffLoadout detects different guns", () => {
    const current = createTestLoadout();
    const vandal = catalogue.weapons.find((w) => w.displayName === "Vandal")!;
    const reaverSkin = vandal.skins.find((s) => s.displayName === "Reaver Vandal")!;
    const target: LoadoutChange = {
      guns: [{ weapon: "Vandal", skin: reaverSkin.uuid }],
    };
    const diff = diffLoadout(current, target, catalogue);
    expect(diff.totalChanges).toBe(1);
    expect(diff.guns).toHaveLength(1);
    expect(diff.guns[0]?.slot).toBe("Vandal");
    expect(diff.guns[0]?.from.name).toBe("Prime Vandal");
    expect(diff.guns[0]?.to.name).toBe("Reaver Vandal");
  });

  it("diffLoadout detects different sprays", () => {
    const current = createTestLoadout();
    const target: LoadoutChange = {
      sprays: ["other-spray-uuid"],
    };
    const diff = diffLoadout(current, target, catalogue);
    expect(diff.totalChanges).toBe(1);
    expect(diff.sprays).toHaveLength(1);
    expect(diff.sprays[0]?.slot).toBe("Spray (Round Start)");
  });

  it("diffLoadout detects different identity", () => {
    const current = createTestLoadout();
    const target: LoadoutChange = {
      card: "diff-card-uuid",
      incognito: true,
    };
    const diff = diffLoadout(current, target, catalogue);
    expect(diff.totalChanges).toBe(2);
    expect(diff.identity).toHaveLength(2);
    expect(diff.identity.find((i) => i.slot === "Card")).toBeDefined();
    expect(diff.identity.find((i) => i.slot === "Incognito")).toBeDefined();
  });

  it("exportLoadout produces valid LoadoutChange matching schema", () => {
    const current = createTestLoadout();
    const exported = exportLoadout(current);
    expect(exported.guns).toHaveLength(1);
    expect(exported.guns?.[0]?.weapon).toBe(current.guns[0]?.weapon.uuid);
    expect(exported.sprays).toHaveLength(1);
    expect(exported.card).toBe(current.card?.uuid);
    expect(exported.title).toBe(current.title?.uuid);
    expect(exported.incognito).toBe(false);
  });

  it("round-trip exportLoadout -> diffLoadout produces 0 changes", () => {
    const current = createTestLoadout();
    const exported = exportLoadout(current);
    const diff = diffLoadout(current, exported, catalogue);
    expect(diff.totalChanges).toBe(0);
    expect(diff.guns).toHaveLength(0);
    expect(diff.sprays).toHaveLength(0);
    expect(diff.identity).toHaveLength(0);
  });
});



