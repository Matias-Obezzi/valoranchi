import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ratingTrend } from "../src/analysis/ratingTrend.js";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import { RankResolver } from "../src/collection/RankResolver.js";
import type { RiotCompetitiveUpdate } from "../src/riot/types.js";

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
