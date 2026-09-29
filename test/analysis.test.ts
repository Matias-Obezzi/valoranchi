import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ratingTrend } from "../src/analysis/ratingTrend.js";
import { performanceSummary } from "../src/analysis/performanceSummary.js";
import { MatchBuilder } from "../src/collection/MatchBuilder.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { RankResolver } from "../src/collection/RankResolver.js";
import type { RiotCompetitiveUpdate, RiotMatchDetailsResponse } from "../src/riot/types.js";

const catalogue = new Catalogue(
  JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
  ) as ValorantApiCatalogueData,
);
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

