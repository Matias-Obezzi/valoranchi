import { MatchBuilder } from "../collection/MatchBuilder.js";
import { MmrBuilder } from "../collection/MmrBuilder.js";
import type { Match, MatchSummary, Mmr, RankChange } from "../model/index.js";
import type { RiotMatchHistoryItem } from "../riot/types.js";
import type { ClientContext } from "./ClientContext.js";

export class MatchService {
  constructor(private readonly context: ClientContext) {}

  async matches(options?: { count?: number; queue?: string }): Promise<MatchSummary[]> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();

    const targetCount = Math.min(Math.max(options?.count ?? 20, 1), 100);
    const collected: RiotMatchHistoryItem[] = [];

    for (let start = 0; start < targetCount; start += 20) {
      if (start > 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
      const end = Math.min(start + 20, targetCount);
      const page = await api.matchHistory(start, end, options?.queue);
      const history = page.History ?? [];
      if (history.length === 0) break;
      collected.push(...history);
      if (history.length < end - start) break;
    }

    const items = collected.slice(0, targetCount);
    const summaries = await Promise.all(
      items.map(async (item) => {
        try {
          const details = await api.matchDetails(item.MatchID);
          return MatchBuilder.toSummary(details, catalogue);
        } catch {
          return {
            id: item.MatchID,
            startedAt: new Date(item.GameStartTime).toISOString(),
            queue: item.QueueID,
            map: { uuid: null, name: null, path: "" },
          };
        }
      }),
    );

    return options?.queue
      ? summaries.filter((s) => s.queue.toLowerCase() === options.queue!.toLowerCase())
      : summaries;
  }

  async match(id: string): Promise<Match> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [details, catalogue] = await Promise.all([
      api.matchDetails(id),
      this.context.catalogue(),
    ]);
    return new MatchBuilder(details, catalogue, session.puuid).build();
  }

  async mmr(): Promise<Mmr> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [rawMmr, catalogue] = await Promise.all([
      api.mmr(),
      this.context.catalogue(),
    ]);
    return new MmrBuilder(catalogue).buildMmr(rawMmr);
  }

  async rankHistory(options?: { count?: number }): Promise<RankChange[]> {
    const count = Math.max(options?.count ?? 20, 1);
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [rawUpdates, catalogue] = await Promise.all([
      api.competitiveUpdates(0, count, "competitive"),
      this.context.catalogue(),
    ]);
    return new MmrBuilder(catalogue).buildRankChanges(rawUpdates.Matches ?? []);
  }
}
