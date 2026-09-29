import type { Catalogue } from "../catalogue/Catalogue.js";
import { playerAssessment } from "../analysis/playerAssessment.js";
import { LiveMatchBuilder } from "../collection/LiveMatchBuilder.js";
import { MmrBuilder } from "../collection/MmrBuilder.js";
import type { LiveMatch, Rank } from "../model/index.js";
import type { RiotApi } from "../riot/RiotApi.js";
import type { ClientContext } from "./ClientContext.js";

export async function resolveLobbyNames(
  api: RiotApi,
  puuids: string[],
): Promise<Map<string, { gameName: string; tagLine: string }>> {
  const map = new Map<string, { gameName: string; tagLine: string }>();
  const unique = Array.from(new Set(puuids.filter(Boolean)));
  if (unique.length === 0) return map;
  try {
    const list = await api.names(unique);
    for (const item of list) {
      map.set(item.Subject, { gameName: item.GameName, tagLine: item.TagLine });
    }
  } catch {}
  return map;
}

export class LiveMatchService {
  private readonly liveRankCache = new Map<string, Rank | null>();

  constructor(private readonly context: ClientContext) {}

  async liveMatch(options?: { ranks?: boolean; loadouts?: boolean }): Promise<LiveMatch> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    const builder = new LiveMatchBuilder(catalogue);

    const pregame = await api.pregamePlayer();
    if (pregame?.MatchID) {
      const match = await api.pregameMatch(pregame.MatchID);
      const allPlayers = [...(match.AllyTeam?.Players ?? []), ...(match.EnemyTeam?.Players ?? [])];
      const puuids = allPlayers.map((p) => p.Subject);
      const accountLevels = new Map(
        allPlayers.map((p) => [p.Subject, p.PlayerIdentity?.AccountLevel ?? null]),
      );
      const names = await resolveLobbyNames(api, puuids);
      const { ranks, warnings } = options?.ranks
        ? await this.resolveLobbyRanksAndWarnings(api, puuids, accountLevels, catalogue)
        : { ranks: new Map<string, Rank | null>(), warnings: new Map<string, string[]>() };
      return builder.buildPregame(match, names, ranks, session.puuid, warnings);
    }

    const core = await api.coreGamePlayer();
    if (core?.MatchID) {
      const match = await api.coreGameMatch(core.MatchID);
      if (match.ProvisioningFlow === "ShootingRange") {
        return { phase: "range", matchId: match.MatchID };
      }
      const puuids = (match.Players ?? []).map((p) => p.Subject);
      const accountLevels = new Map(
        (match.Players ?? []).map((p) => [p.Subject, p.PlayerIdentity?.AccountLevel ?? null]),
      );
      const names = await resolveLobbyNames(api, puuids);
      const rawLoadouts =
        options?.loadouts !== false ? await api.coreGameLoadouts(core.MatchID) : null;
      const { ranks, warnings } = options?.ranks
        ? await this.resolveLobbyRanksAndWarnings(api, puuids, accountLevels, catalogue)
        : { ranks: new Map<string, Rank | null>(), warnings: new Map<string, string[]>() };
      return builder.buildCoreGame(match, rawLoadouts, names, ranks, session.puuid, warnings);
    }

    return { phase: "none" };
  }

  private async resolveLobbyRanksAndWarnings(
    api: RiotApi,
    puuids: string[],
    accountLevels: Map<string, number | null>,
    catalogue: Catalogue,
  ): Promise<{ ranks: Map<string, Rank | null>; warnings: Map<string, string[]> }> {
    const ranks = new Map<string, Rank | null>();
    const warnings = new Map<string, string[]>();
    const mmrBuilder = new MmrBuilder(catalogue);
    const unique = Array.from(new Set(puuids.filter(Boolean)));

    for (let i = 0; i < unique.length; i++) {
      const puuid = unique[i]!;
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
      try {
        const [raw, rawUpdates] = await Promise.all([
          api.mmr(puuid),
          api.competitiveUpdates(0, 20, "competitive", puuid).catch(() => ({ Matches: [] })),
        ]);
        const mmr = mmrBuilder.buildMmr(raw, rawUpdates.Matches ?? []);
        this.liveRankCache.set(puuid, mmr.current);
        ranks.set(puuid, mmr.current);

        const level = accountLevels.get(puuid) ?? null;
        const assessment = playerAssessment({
          puuid,
          accountLevel: level,
          mmr,
          updates: rawUpdates.Matches ?? [],
        });
        warnings.set(puuid, assessment.warnings);
      } catch {
        this.liveRankCache.set(puuid, null);
        ranks.set(puuid, null);
        warnings.set(puuid, []);
      }
    }
    return { ranks, warnings };
  }
}
