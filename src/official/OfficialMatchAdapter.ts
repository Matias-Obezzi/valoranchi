import type { Catalogue } from "../catalogue/Catalogue.js";
import { RankResolver } from "../collection/RankResolver.js";
import type { Leaderboard, LeaderboardEntry } from "../model/index.js";
import type {
  RiotDamage,
  RiotKill,
  RiotMatchDetailsResponse,
  RiotMatchInfo,
  RiotMatchPlayer,
  RiotMatchTeam,
  RiotRoundPlayerStats,
  RiotRoundResult,
} from "../riot/types.js";
import type {
  OfficialDamage,
  OfficialKill,
  OfficialLeaderboardResponse,
  OfficialMatchPlayer,
  OfficialMatchResponse,
  OfficialMatchTeam,
  OfficialRoundPlayerStats,
  OfficialRoundResult,
} from "./types.js";

function mapMatchInfo(official: OfficialMatchResponse): RiotMatchInfo {
  const info = official.matchInfo;
  return {
    matchId: info.matchId,
    mapId: info.mapId,
    gameLengthMillis: info.gameLengthMillis ?? 0,
    gameStartMillis: info.gameStartMillis ?? 0,
    provisioningFlowID: info.provisioningFlowId ?? info.provisioningFlowID ?? "Matchmaking",
    isCompleted: Boolean(info.isCompleted),
    customGameName: info.customGameName ?? null,
    queueID: info.queueId ?? info.queueID ?? "",
    gameMode: info.gameMode ?? "",
    isRanked: Boolean(info.isRanked),
    seasonId: info.seasonId,
    completionState: info.completionState,
    platformId: info.platformId,
    gameServerAddress: info.gameServerAddress,
    gameVersion: info.gameVersion,
    isReplayRecorded: info.isReplayRecorded,
  };
}

function mapPlayer(p: OfficialMatchPlayer): RiotMatchPlayer {
  return {
    subject: p.puuid ?? p.subject ?? "",
    gameName: p.gameName ?? "",
    tagLine: p.tagLine ?? "",
    teamId: p.teamId ?? "",
    partyId: p.partyId,
    characterId: p.characterId ?? "",
    stats: p.stats
      ? {
          score: p.stats.score ?? 0,
          roundsPlayed: p.stats.roundsPlayed ?? 0,
          kills: p.stats.kills ?? 0,
          deaths: p.stats.deaths ?? 0,
          assists: p.stats.assists ?? 0,
          playtimeMillis: p.stats.playtimeMillis,
          abilityCasts: p.stats.abilityCasts
            ? {
                grenadeCasts: p.stats.abilityCasts.grenadeCasts,
                ability1Casts: p.stats.abilityCasts.ability1Casts,
                ability2Casts: p.stats.abilityCasts.ability2Casts,
                ultimateCasts: p.stats.abilityCasts.ultimateCasts,
              }
            : undefined,
        }
      : null,
    competitiveTier: p.competitiveTier,
    playerCard: p.playerCard,
    playerTitle: p.playerTitle,
    accountLevel: p.accountLevel,
  };
}

function mapTeams(teams: OfficialMatchTeam[] | null | undefined): RiotMatchTeam[] | null {
  if (!teams) return null;
  return teams.map((t) => ({
    teamId: t.teamId,
    won: Boolean(t.won),
    roundsPlayed: t.roundsPlayed ?? 0,
    roundsWon: t.roundsWon ?? 0,
    numPoints: t.numPoints,
  }));
}

function mapDamage(damage?: OfficialDamage[]): RiotDamage[] | undefined {
  if (!damage) return undefined;
  return damage.map((d) => ({
    receiver: d.receiver ?? d.puuid ?? "",
    damage: d.damage ?? 0,
    legshots: d.legshots ?? 0,
    bodyshots: d.bodyshots ?? 0,
    headshots: d.headshots ?? 0,
  }));
}

function mapKills(kills?: OfficialKill[]): RiotKill[] | undefined {
  if (!kills) return undefined;
  return kills.map((k) => ({
    gameTime: k.gameTime,
    roundTime: k.roundTime ?? 0,
    killer: k.killer ?? "",
    victim: k.victim ?? "",
    victimLocation: k.victimLocation ?? null,
    assistants: k.assistants ?? [],
    finishingDamage: k.finishingDamage
      ? {
          damageType: k.finishingDamage.damageType ?? "Unknown",
          damageItem: k.finishingDamage.damageItem ?? "",
          isSecondaryFireMode: k.finishingDamage.isSecondaryFireMode,
        }
      : undefined,
  }));
}

function mapRoundPlayerStats(stats?: OfficialRoundPlayerStats[]): RiotRoundPlayerStats[] {
  if (!stats) return [];
  return stats.map((ps) => ({
    subject: ps.puuid ?? ps.subject ?? "",
    score: ps.score,
    damage: mapDamage(ps.damage),
    kills: mapKills(ps.kills),
  }));
}

function mapRoundResults(results?: OfficialRoundResult[] | null): RiotRoundResult[] | null {
  if (!results) return null;
  return results.map((r) => ({
    roundNum: r.roundNum,
    roundResult: r.roundResult,
    roundCeremony: r.roundCeremony ?? null,
    winningTeam: r.winningTeam,
    bombPlanter: r.bombPlanter ?? r.planter ?? null,
    bombDefuser: r.bombDefuser ?? r.defuser ?? null,
    plantRoundTime: r.plantRoundTime ?? null,
    plantSite: r.plantSite ?? null,
    defuseRoundTime: r.defuseRoundTime ?? null,
    playerStats: mapRoundPlayerStats(r.playerStats),
  }));
}

export function toMatchDetails(official: OfficialMatchResponse): RiotMatchDetailsResponse {
  return {
    matchInfo: mapMatchInfo(official),
    players: (official.players ?? []).map(mapPlayer),
    teams: mapTeams(official.teams),
    roundResults: mapRoundResults(official.roundResults),
  };
}

export function toLeaderboard(
  official: OfficialLeaderboardResponse,
  catalogue: Catalogue,
): Leaderboard {
  const rankResolver = new RankResolver(catalogue);
  const entries: LeaderboardEntry[] = (official.players ?? []).map((p) => ({
    rank: p.leaderboardRank,
    puuid: p.puuid,
    gameName: p.gameName ?? "",
    tagLine: p.tagLine ?? "",
    anonymized: false,
    banned: false,
    rating: p.rankedRating,
    wins: p.numberOfWins,
    tier: rankResolver.fromTier(p.competitiveTier, p.rankedRating),
  }));

  return {
    season: official.actId,
    total: official.totalPlayers,
    entries,
    tierThresholds: {},
  };
}

export class OfficialMatchAdapter {
  static toMatchDetails(official: OfficialMatchResponse): RiotMatchDetailsResponse {
    return toMatchDetails(official);
  }

  static toLeaderboard(official: OfficialLeaderboardResponse, catalogue: Catalogue): Leaderboard {
    return toLeaderboard(official, catalogue);
  }
}
