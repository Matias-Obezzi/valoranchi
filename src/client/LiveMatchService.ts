import type { Catalogue } from "../catalogue/Catalogue.js";
import { LiveMatchBuilder } from "../collection/LiveMatchBuilder.js";
import { MmrBuilder } from "../collection/MmrBuilder.js";
import { PartyBuilder } from "../collection/PartyBuilder.js";
import type { LiveMatch, Party, Rank } from "../model/index.js";
import type { RiotApi } from "../riot/RiotApi.js";
import type { ClientContext } from "./ClientContext.js";

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
      const puuids = [
        ...(match.AllyTeam?.Players ?? []).map((p) => p.Subject),
        ...(match.EnemyTeam?.Players ?? []).map((p) => p.Subject),
      ];
      const names = await this.resolveLobbyNames(api, puuids);
      const ranks = options?.ranks
        ? await this.resolveLobbyRanks(api, puuids, catalogue)
        : new Map<string, Rank | null>();
      return builder.buildPregame(match, names, ranks, session.puuid);
    }

    const core = await api.coreGamePlayer();
    if (core?.MatchID) {
      const match = await api.coreGameMatch(core.MatchID);
      if (match.ProvisioningFlow === "ShootingRange") {
        return { phase: "range", matchId: match.MatchID };
      }
      const puuids = (match.Players ?? []).map((p) => p.Subject);
      const names = await this.resolveLobbyNames(api, puuids);
      const rawLoadouts =
        options?.loadouts !== false ? await api.coreGameLoadouts(core.MatchID) : null;
      const ranks = options?.ranks
        ? await this.resolveLobbyRanks(api, puuids, catalogue)
        : new Map<string, Rank | null>();
      return builder.buildCoreGame(match, rawLoadouts, names, ranks, session.puuid);
    }

    return { phase: "none" };
  }

  async party(): Promise<Party> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID) {
      return null;
    }
    const [rawParty, catalogue] = await Promise.all([
      api.party(partyPlayer.CurrentPartyID),
      this.context.catalogue(),
    ]);
    const puuids = (rawParty.Members ?? []).map((m) => m.Subject);
    const names = await this.resolveLobbyNames(api, puuids);
    return new PartyBuilder(catalogue).build(rawParty, names);
  }

  private async resolveLobbyNames(
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

  private async resolveLobbyRanks(
    api: RiotApi,
    puuids: string[],
    catalogue: Catalogue,
  ): Promise<Map<string, Rank | null>> {
    const ranks = new Map<string, Rank | null>();
    const mmrBuilder = new MmrBuilder(catalogue);
    const unique = Array.from(new Set(puuids.filter(Boolean)));

    for (let i = 0; i < unique.length; i++) {
      const puuid = unique[i]!;
      if (this.liveRankCache.has(puuid)) {
        ranks.set(puuid, this.liveRankCache.get(puuid)!);
        continue;
      }
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 250));
      }
      try {
        const raw = await api.mmr(puuid);
        const mmr = mmrBuilder.buildMmr(raw);
        this.liveRankCache.set(puuid, mmr.current);
        ranks.set(puuid, mmr.current);
      } catch {
        this.liveRankCache.set(puuid, null);
        ranks.set(puuid, null);
      }
    }
    return ranks;
  }
}
