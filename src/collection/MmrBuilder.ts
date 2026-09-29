import type { Catalogue } from "../catalogue/Catalogue.js";
import type { Mmr, Rank, RankChange, RankMovement } from "../model/index.js";
import type { RiotCompetitiveUpdate, RiotMmrResponse, RiotSeasonalInfo } from "../riot/types.js";
import { rankFit } from "./RankFit.js";
import { RankResolver, resolveSeasonName } from "./RankResolver.js";

export function rankMovement(tierBefore: number, tierAfter: number, earned: number): RankMovement {
  if (tierAfter > tierBefore) return "promoted";
  if (tierAfter < tierBefore) return "demoted";
  if (earned > 0) return "up";
  if (earned < 0) return "down";
  return "same";
}

export class MmrBuilder {
  private readonly catalogue: Catalogue;
  private readonly rankResolver: RankResolver;

  constructor(catalogue: Catalogue) {
    this.catalogue = catalogue;
    this.rankResolver = new RankResolver(catalogue);
  }

  buildMmr(raw: RiotMmrResponse, updates: RiotCompetitiveUpdate[] = []): Mmr {
    const currentAct = this.catalogue.currentAct();
    const currentActUuid = currentAct?.uuid ?? null;
    const competitiveSkills = raw.QueueSkills?.competitive;
    const seasonalInfo = currentActUuid
      ? competitiveSkills?.SeasonalInfoBySeasonID?.[currentActUuid]
      : undefined;

    const current = this.resolveCurrentRank(raw, currentActUuid, seasonalInfo);
    return {
      current,
      fit: rankFit(current, updates, this.rankResolver),
      peak: this.resolvePeakRank(competitiveSkills?.SeasonalInfoBySeasonID),
      act: currentActUuid
        ? {
            uuid: currentActUuid,
            name: resolveSeasonName(this.catalogue, currentActUuid),
            games: seasonalInfo?.NumberOfGames ?? 0,
            wins: seasonalInfo?.NumberOfWins ?? 0,
            gamesNeededForRating:
              seasonalInfo?.GamesNeededForRating ??
              competitiveSkills?.CurrentSeasonGamesNeededForRating ??
              0,
          }
        : null,
      lastUpdate: this.buildLastUpdate(raw.LatestCompetitiveUpdate),
      leaderboardAnonymized: Boolean(raw.IsLeaderboardAnonymized),
    };
  }

  buildRankChanges(updates: RiotCompetitiveUpdate[]): RankChange[] {
    return updates.map((u) => {
      const map = this.catalogue.getMapByPath(u.MapID);
      return {
        matchId: u.MatchID,
        at: new Date(u.MatchStartTime).toISOString(),
        map: {
          name: map?.displayName ?? null,
          path: u.MapID,
        },
        before: this.rankResolver.fromTier(u.TierBeforeUpdate, u.RankedRatingBeforeUpdate),
        after: this.rankResolver.fromTier(u.TierAfterUpdate, u.RankedRatingAfterUpdate),
        earned: u.RankedRatingEarned,
        bonus: u.RankedRatingPerformanceBonus,
        movement: rankMovement(u.TierBeforeUpdate, u.TierAfterUpdate, u.RankedRatingEarned),
        afkPenalty: u.AFKPenalty,
      };
    });
  }

  private resolveCurrentRank(
    raw: RiotMmrResponse,
    currentActUuid: string | null,
    seasonalInfo?: RiotSeasonalInfo,
  ): Rank | null {
    const latest = raw.LatestCompetitiveUpdate;
    if (latest && currentActUuid && latest.SeasonID === currentActUuid) {
      return this.rankResolver.fromTier(latest.TierAfterUpdate, latest.RankedRatingAfterUpdate);
    }
    const tier = seasonalInfo?.CompetitiveTier ?? seasonalInfo?.Rank ?? 0;
    const rating = seasonalInfo?.RankedRating ?? null;
    return this.rankResolver.fromTier(tier, rating);
  }

  private resolvePeakRank(
    seasons?: Record<string, RiotSeasonalInfo>,
  ): (Rank & { act: { uuid: string; name: string | null } }) | null {
    if (!seasons) return null;
    let bestTier = 0;
    let bestSeason: string | null = null;
    let bestStart = "";

    for (const [seasonId, info] of Object.entries(seasons)) {
      const peak = this.computeActPeak(info);
      if (peak <= 0) continue;
      const start = this.catalogue.getSeason(seasonId)?.startTime ?? "";
      if (peak > bestTier || (peak === bestTier && start > bestStart)) {
        bestTier = peak;
        bestSeason = seasonId;
        bestStart = start;
      }
    }

    if (bestTier <= 0 || !bestSeason) return null;
    const rank = this.rankResolver.fromTier(bestTier, null);
    return {
      ...rank,
      act: {
        uuid: bestSeason,
        name: resolveSeasonName(this.catalogue, bestSeason),
      },
    };
  }

  private computeActPeak(info: RiotSeasonalInfo): number {
    let peak = 0;
    if (info.WinsByTier) {
      for (const [tierStr, count] of Object.entries(info.WinsByTier)) {
        const tierNum = Number(tierStr);
        if (count > 0 && tierNum > peak) {
          peak = tierNum;
        }
      }
    }
    if (peak > 0) return peak;
    if (typeof info.Rank === "number" && info.Rank > peak) {
      peak = info.Rank;
    }
    if (typeof info.CompetitiveTier === "number" && info.CompetitiveTier > peak) {
      peak = info.CompetitiveTier;
    }
    return peak;
  }

  private buildLastUpdate(update?: RiotCompetitiveUpdate | null): Mmr["lastUpdate"] {
    if (!update || !update.MatchID) return null;
    return {
      matchId: update.MatchID,
      at: new Date(update.MatchStartTime).toISOString(),
      before: this.rankResolver.fromTier(update.TierBeforeUpdate, update.RankedRatingBeforeUpdate),
      after: this.rankResolver.fromTier(update.TierAfterUpdate, update.RankedRatingAfterUpdate),
      earned: update.RankedRatingEarned,
      movement: rankMovement(
        update.TierBeforeUpdate,
        update.TierAfterUpdate,
        update.RankedRatingEarned,
      ),
    };
  }
}
