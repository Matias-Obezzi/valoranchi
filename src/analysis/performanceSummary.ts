import type { Catalogue } from "../catalogue/Catalogue.js";
import type {
  AgentPerformance,
  Image,
  MapPerformance,
  Match,
  MatchPlayer,
  PerformanceConsistency,
  PerformanceStats,
  PerformanceSummary,
} from "../model/index.js";

function getPlayer(match: Match, puuid: string): MatchPlayer | undefined {
  return match.players.find((p) => p.puuid === puuid);
}

function isWin(match: Match, puuid: string): boolean {
  if (match.self?.won !== null && match.self?.won !== undefined) {
    const selfPlayer = getPlayer(match, puuid);
    if (selfPlayer?.team === match.self.team) {
      return Boolean(match.self.won);
    }
  }
  const player = getPlayer(match, puuid);
  if (!player) return false;
  return Boolean(match.teams.find((t) => t.id === player.team)?.won);
}

function computeStats(matches: Match[], puuid: string): PerformanceStats {
  const games = matches.length;
  if (games === 0) {
    return {
      games: 0,
      wins: 0,
      winRate: 0,
      kd: 0,
      kda: 0,
      headshotRate: 0,
      averageScore: 0,
      averageDamagePerRound: 0,
      firstBloodsPerGame: 0,
      plantsPerGame: 0,
      defusesPerGame: 0,
    };
  }

  let wins = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let score = 0;
  let damage = 0;
  let rounds = 0;
  let headshots = 0;
  let bodyshots = 0;
  let legshots = 0;
  let firstBloods = 0;
  let plants = 0;
  let defuses = 0;

  for (const m of matches) {
    if (isWin(m, puuid)) wins++;
    const p = getPlayer(m, puuid);
    if (p?.stats) {
      kills += p.stats.kills;
      deaths += p.stats.deaths;
      assists += p.stats.assists;
      score += p.stats.score;
      damage += p.stats.damage;
      rounds += p.stats.roundsPlayed;
      headshots += p.stats.headshots;
      bodyshots += p.stats.bodyshots;
      legshots += p.stats.legshots;
      firstBloods += p.stats.firstBloods;
      plants += p.stats.plants;
      defuses += p.stats.defuses;
    }
  }

  const totalShots = headshots + bodyshots + legshots;
  return {
    games,
    wins,
    winRate: Math.round((wins / games) * 100) / 100,
    kd: deaths === 0 ? kills : Math.round((kills / deaths) * 100) / 100,
    kda: deaths === 0 ? kills + assists : Math.round(((kills + assists) / deaths) * 100) / 100,
    headshotRate: totalShots === 0 ? 0 : Math.round((headshots / totalShots) * 100) / 100,
    averageScore: Math.round(score / games),
    averageDamagePerRound: rounds === 0 ? 0 : Math.round((damage / rounds) * 10) / 10,
    firstBloodsPerGame: Math.round((firstBloods / games) * 10) / 10,
    plantsPerGame: Math.round((plants / games) * 10) / 10,
    defusesPerGame: Math.round((defuses / games) * 10) / 10,
  };
}

function computeConsistency(matches: Match[], puuid: string): PerformanceConsistency {
  if (matches.length === 0) {
    return { scoreStdDev: 0, gamesNonNegative: 0, longestNonNegativeStreak: 0 };
  }

  const scores: number[] = [];
  let gamesNonNegative = 0;
  let longestNonNegativeStreak = 0;
  let currentStreak = 0;

  for (const m of matches) {
    const p = getPlayer(m, puuid);
    const s = p?.stats?.score ?? 0;
    scores.push(s);

    const k = p?.stats?.kills ?? 0;
    const d = p?.stats?.deaths ?? 0;
    if (k >= d) {
      gamesNonNegative++;
      currentStreak++;
      if (currentStreak > longestNonNegativeStreak) {
        longestNonNegativeStreak = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  const mean = scores.reduce((sum, val) => sum + val, 0) / scores.length;
  const variance = scores.reduce((sum, val) => sum + (val - mean) ** 2, 0) / scores.length;
  const scoreStdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  return {
    scoreStdDev,
    gamesNonNegative,
    longestNonNegativeStreak,
  };
}

function pickBestAndWorst<T extends PerformanceStats>(
  items: T[],
): { best: T | null; worst: T | null } {
  const eligible = items.filter((item) => item.games >= 3);
  if (eligible.length === 0) {
    return { best: null, worst: null };
  }
  const sorted = [...eligible].sort((a, b) => {
    if (a.winRate !== b.winRate) return b.winRate - a.winRate;
    return b.kd - a.kd;
  });
  return {
    best: sorted[0]!,
    worst: sorted[sorted.length - 1]!,
  };
}

export function performanceSummary(
  matches: Match[],
  puuid: string,
  catalogue?: Catalogue,
): PerformanceSummary {
  const overall = computeStats(matches, puuid);
  const consistency = computeConsistency(matches, puuid);

  const agentGroups = new Map<string, Match[]>();
  for (const m of matches) {
    const p = getPlayer(m, puuid);
    const key = p?.agent?.uuid ?? "unknown";
    const list = agentGroups.get(key) ?? [];
    list.push(m);
    agentGroups.set(key, list);
  }

  const byAgent: AgentPerformance[] = Array.from(agentGroups.entries()).map(([uuid, list]) => {
    const firstPlayer = getPlayer(list[0]!, puuid);
    return {
      uuid,
      name: firstPlayer?.agent?.name ?? "Unknown",
      icon: firstPlayer?.agent?.icon ?? null,
      ...computeStats(list, puuid),
    };
  });

  const mapGroups = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.map.path || (m.map.uuid ?? "unknown");
    const list = mapGroups.get(key) ?? [];
    list.push(m);
    mapGroups.set(key, list);
  }

  const byMap: MapPerformance[] = Array.from(mapGroups.entries()).map(([pathKey, list]) => {
    const firstMatch = list[0]!;
    const catMap = catalogue?.getMapByPath(firstMatch.map.path);
    const icon: Image = catMap?.displayIcon ?? null;
    return {
      uuid: firstMatch.map.uuid,
      name: firstMatch.map.name ?? pathKey,
      icon,
      ...computeStats(list, puuid),
    };
  });

  const agentBestWorst = pickBestAndWorst(byAgent);
  const mapBestWorst = pickBestAndWorst(byMap);

  return {
    overall,
    byAgent,
    byMap,
    best: {
      agent: agentBestWorst.best,
      map: mapBestWorst.best,
    },
    worst: {
      agent: agentBestWorst.worst,
      map: mapBestWorst.worst,
    },
    consistency,
  };
}
