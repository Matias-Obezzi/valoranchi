import { ContentBuilder } from "../collection/ContentBuilder.js";
import { LeaderboardBuilder } from "../collection/LeaderboardBuilder.js";
import { MatchBuilder } from "../collection/MatchBuilder.js";
import { MmrBuilder } from "../collection/MmrBuilder.js";
import type {
  Content,
  Leaderboard,
  LiveMatch,
  Match,
  MatchSummary,
  Mmr,
  Premier,
  RankChange,
} from "../model/index.js";
import type { RiotMatchHistoryItem } from "../riot/types.js";
import type { MatchesApi } from "./api.js";
import type { ClientContext } from "./ClientContext.js";
import { LiveMatchService } from "./LiveMatchService.js";
import { MatchValidator } from "./MatchValidator.js";
import { ValidationError } from "../errors.js";

export class MatchService implements MatchesApi {
  private readonly liveMatchService: LiveMatchService;

  constructor(private readonly context: ClientContext) {
    this.liveMatchService = new LiveMatchService(context);
  }

  async list(options?: { count?: number; queue?: string }): Promise<MatchSummary[]> {
    const session = await this.context.sessions.session();
    return this.fetchMatchList(session.puuid, options);
  }

  async listFor(
    puuid: string,
    options?: { count?: number; queue?: string },
  ): Promise<MatchSummary[]> {
    return this.fetchMatchList(puuid, options);
  }

  private async fetchMatchList(
    puuid: string,
    options?: { count?: number; queue?: string },
  ): Promise<MatchSummary[]> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    const targetCount = Math.min(Math.max(options?.count ?? 20, 1), 100);
    const collected: RiotMatchHistoryItem[] = [];

    for (let start = 0; start < targetCount; start += 20) {
      if (start > 0) await new Promise((r) => setTimeout(r, 500));
      const end = Math.min(start + 20, targetCount);
      const page = await api.matchHistory(start, end, options?.queue, puuid);
      const history = page.History ?? [];
      if (history.length === 0) break;
      collected.push(...history);
      if (history.length < end - start) break;
    }

    const summaries = await Promise.all(
      collected.slice(0, targetCount).map(async (item) => {
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

  async get(id: string): Promise<Match> {
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
    return this.mmrFor(session.puuid);
  }

  async mmrFor(puuid: string): Promise<Mmr> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [rawMmr, rawUpdates, catalogue] = await Promise.all([
      api.mmr(puuid),
      api.competitiveUpdates(0, 20, "competitive", puuid),
      this.context.catalogue(),
    ]);
    return new MmrBuilder(catalogue).buildMmr(rawMmr, rawUpdates.Matches ?? []);
  }

  async rankHistory(options?: { count?: number }): Promise<RankChange[]> {
    const session = await this.context.sessions.session();
    return this.rankHistoryFor(session.puuid, options);
  }

  async rankHistoryFor(puuid: string, options?: { count?: number }): Promise<RankChange[]> {
    const count = Math.max(options?.count ?? 20, 1);
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [rawUpdates, catalogue] = await Promise.all([
      api.competitiveUpdates(0, count, "competitive", puuid),
      this.context.catalogue(),
    ]);
    return new MmrBuilder(catalogue).buildRankChanges(rawUpdates.Matches ?? []);
  }

  async live(options?: { ranks?: boolean; loadouts?: boolean }): Promise<LiveMatch> {
    return this.liveMatchService.liveMatch(options);
  }

  async leaderboard(options?: {
    season?: string;
    start?: number;
    size?: number;
    query?: string;
  }): Promise<Leaderboard> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    let seasonId = options?.season ?? catalogue.currentAct()?.uuid;
    if (!seasonId) {
      const content = await api.content();
      const activeAct = content.Seasons.find((s) => s.Type.toLowerCase() === "act" && s.IsActive);
      seasonId = activeAct?.ID ?? "";
    }
    const raw = await api.leaderboard(
      seasonId,
      options?.start ?? 0,
      options?.size ?? 100,
      options?.query ?? "",
    );
    return new LeaderboardBuilder(catalogue).build(raw);
  }

  async content(): Promise<Content> {
    const session = await this.context.sessions.session();
    const raw = await this.context.api(session).content();
    return ContentBuilder.build(raw);
  }

  async premier(): Promise<Premier> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [eligibility, roster, activeSeason, conferences] = await Promise.all([
      api.premierEligibility().catch(() => null),
      api.premierPlayer().catch(() => null),
      api.premierActiveSeason().catch(() => null),
      api.premierConferences().catch(() => null),
    ]);

    const eligRecord = eligibility as Record<string, unknown> | null;
    const isEligible = eligRecord
      ? typeof eligRecord.eligible === "boolean"
        ? eligRecord.eligible
        : typeof eligRecord.IsEligible === "boolean"
          ? eligRecord.IsEligible
          : true
      : null;

    return {
      eligible: isEligible,
      roster,
      season: activeSeason,
      conferences,
    };
  }

  async validateSelectAgent(
    agent: string,
  ): Promise<{ method: string; path: string; matchId: string; agentUuid: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    const pregame = await api.pregamePlayer();
    if (!pregame?.MatchID) {
      throw new ValidationError("not-in-pregame", "Not currently in pregame agent select");
    }
    const [pregameMatch, entitlements] = await Promise.all([
      api.pregameMatch(pregame.MatchID),
      api.entitlements(),
    ]);
    return MatchValidator.validateSelectOrLock(
      pregameMatch,
      catalogue,
      entitlements,
      agent,
      session.puuid,
      "select",
    );
  }

  async selectAgent(agent: string): Promise<LiveMatch> {
    const validated = await this.validateSelectAgent(agent);
    const session = await this.context.sessions.session();
    await this.context.api(session).selectAgent(validated.matchId, validated.agentUuid);
    return this.live();
  }

  async validateLockAgent(
    agent: string,
  ): Promise<{ method: string; path: string; matchId: string; agentUuid: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const catalogue = await this.context.catalogue();
    const pregame = await api.pregamePlayer();
    if (!pregame?.MatchID) {
      throw new ValidationError("not-in-pregame", "Not currently in pregame agent select");
    }
    const [pregameMatch, entitlements] = await Promise.all([
      api.pregameMatch(pregame.MatchID),
      api.entitlements(),
    ]);
    return MatchValidator.validateSelectOrLock(
      pregameMatch,
      catalogue,
      entitlements,
      agent,
      session.puuid,
      "lock",
    );
  }

  async lockAgent(agent: string): Promise<LiveMatch> {
    const validated = await this.validateLockAgent(agent);
    const session = await this.context.sessions.session();
    await this.context.api(session).lockAgent(validated.matchId, validated.agentUuid);
    return this.live();
  }

  async validateDodge(options?: {
    confirm?: boolean;
  }): Promise<{ method: string; path: string; matchId: string }> {
    const session = await this.context.sessions.session();
    const pregame = await this.context.api(session).pregamePlayer();
    return MatchValidator.validateDodge(pregame, options);
  }

  async dodge(options?: { confirm?: boolean }): Promise<{ dodged: boolean; matchId: string }> {
    const validated = await this.validateDodge(options);
    const session = await this.context.sessions.session();
    await this.context.api(session).quitPregameMatch(validated.matchId);
    return { dodged: true, matchId: validated.matchId };
  }

  async validateLeaveMatch(options?: {
    confirm?: boolean;
  }): Promise<{ method: string; path: string; matchId: string; puuid: string }> {
    const session = await this.context.sessions.session();
    const core = await this.context.api(session).coreGamePlayer();
    return MatchValidator.validateLeaveMatch(core, session.puuid, options);
  }

  async leaveMatch(options?: { confirm?: boolean }): Promise<{ left: boolean; matchId: string }> {
    const validated = await this.validateLeaveMatch(options);
    const session = await this.context.sessions.session();
    await this.context.api(session).disassociatePlayer(validated.matchId, session.puuid);
    return { left: true, matchId: validated.matchId };
  }
}
