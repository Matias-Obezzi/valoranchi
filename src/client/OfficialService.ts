import { MatchBuilder } from "../collection/MatchBuilder.js";
import { ValidationError } from "../errors.js";
import type { Leaderboard, Match, MatchSummary, OfficialAccount } from "../model/index.js";
import { OfficialApi } from "../official/OfficialApi.js";
import { toLeaderboard, toMatchDetails } from "../official/OfficialMatchAdapter.js";
import type { OfficialPlatformData } from "../official/types.js";
import { HttpGateway } from "../riot/HttpGateway.js";
import type { OfficialApi as OfficialApiInterface } from "./api.js";
import { ChatValidator } from "./ChatValidator.js";
import type { ClientContext } from "./ClientContext.js";

export class OfficialService implements OfficialApiInterface {
  private readonly rawApi: OfficialApi;

  constructor(
    private readonly context: ClientContext,
    rawApi?: OfficialApi,
  ) {
    this.rawApi =
      rawApi ??
      new OfficialApi(
        context.gateway ?? new HttpGateway(),
        context.officialApiKey ?? process.env.RIOT_API_KEY,
      );
  }

  async account(riotId: string): Promise<OfficialAccount> {
    const { gameName, gameTag } = ChatValidator.parseRiotId(riotId);
    const acc = await this.rawApi.accountByRiotId(gameName, gameTag);
    if (!acc) {
      throw new ValidationError("player-not-found", `Player '${riotId}' not found`, { riotId });
    }
    const shardInfo = await this.rawApi.activeShard(acc.puuid);
    if (!shardInfo?.activeShard) {
      throw new ValidationError("shard-not-found", `No VALORANT shard for '${riotId}'`, { riotId });
    }
    return {
      puuid: acc.puuid,
      gameName: acc.gameName,
      tagLine: acc.tagLine,
      shard: shardInfo.activeShard,
    };
  }

  async matches(
    riotId: string,
    options: { queue?: string; count?: number } = {},
  ): Promise<MatchSummary[]> {
    const acc = await this.account(riotId);
    const matchlist = await this.rawApi.matchlist(acc.shard, acc.puuid);
    let history = matchlist?.history ?? [];

    if (options.queue) {
      const targetQueue = options.queue.toLowerCase();
      history = history.filter((h) => h.queueId.toLowerCase() === targetQueue);
    }

    history.sort((a, b) => b.gameStartTimeMillis - a.gameStartTimeMillis);

    const count = options.count ?? 10;
    history = history.slice(0, count);

    const catalogue = await this.context.catalogue();
    const summaries: MatchSummary[] = [];
    for (const item of history) {
      const matchData = await this.rawApi.match(acc.shard, item.matchId);
      if (matchData) {
        const details = toMatchDetails(matchData);
        summaries.push(MatchBuilder.toSummary(details, catalogue));
      }
    }

    return summaries.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }

  async match(matchId: string, options: { shard: string; self?: string }): Promise<Match> {
    const matchData = await this.rawApi.match(options.shard, matchId);
    if (!matchData) {
      throw new ValidationError("match-not-found", `Match '${matchId}' not found`, { matchId });
    }
    const details = toMatchDetails(matchData);
    const selfPuuid = options.self ?? details.players[0]?.subject ?? "";
    const catalogue = await this.context.catalogue();
    const builder = new MatchBuilder(details, catalogue, selfPuuid);
    return builder.build();
  }

  async leaderboard(options: {
    shard: string;
    act?: string;
    start?: number;
    size?: number;
  }): Promise<Leaderboard> {
    let actId = options.act;
    if (!actId) {
      const contents = await this.rawApi.contents(options.shard);
      const activeAct =
        contents?.acts?.find((a) => a.isActive && (a.type === "act" || !a.type)) ??
        contents?.acts?.find((a) => a.isActive);
      if (!activeAct) {
        throw new ValidationError("active-act-not-found", "Could not determine active act", {
          shard: options.shard,
        });
      }
      actId = activeAct.id;
    }

    const rawLb = await this.rawApi.leaderboard(options.shard, actId, {
      size: options.size ?? 50,
      startIndex: options.start ?? 0,
    });

    if (!rawLb) {
      return {
        season: actId,
        total: 0,
        entries: [],
        tierThresholds: {},
      };
    }

    const catalogue = await this.context.catalogue();
    return toLeaderboard(rawLb, catalogue);
  }

  async status(shard: string): Promise<OfficialPlatformData> {
    return this.rawApi.platformStatus(shard);
  }
}
