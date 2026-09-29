import type { Catalogue } from "../catalogue/Catalogue.js";
import type { Leaderboard, LeaderboardEntry } from "../model/index.js";
import type { RiotLeaderboardResponse } from "../riot/types.js";
import { RankResolver } from "./RankResolver.js";

export class LeaderboardBuilder {
  private readonly rankResolver: RankResolver;

  constructor(catalogue: Catalogue) {
    this.rankResolver = new RankResolver(catalogue);
  }

  build(raw: RiotLeaderboardResponse): Leaderboard {
    const entries: LeaderboardEntry[] = (raw.Players ?? []).map((p) => ({
      rank: p.leaderboardRank,
      puuid: p.puuid,
      gameName: p.gameName,
      tagLine: p.tagLine,
      anonymized: Boolean(p.IsAnonymized),
      banned: Boolean(p.IsBanned),
      rating: p.rankedRating,
      wins: p.numberOfWins,
      tier: this.rankResolver.fromTier(p.competitiveTier, p.rankedRating),
    }));

    const tierThresholds: Record<string, number> = {};
    for (const [tier, detail] of Object.entries(raw.tierDetails ?? {})) {
      tierThresholds[tier] = detail.rankedRatingThreshold;
    }

    return {
      season: raw.SeasonID,
      total: raw.totalPlayers,
      entries,
      tierThresholds,
    };
  }
}
