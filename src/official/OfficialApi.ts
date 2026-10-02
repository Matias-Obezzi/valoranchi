import { OfficialApiKeyMissingError, RiotApiError, ValidationError } from "../errors.js";
import type { HttpGateway } from "../riot/HttpGateway.js";
import type { FileResponseCache } from "../riot/ResponseCache.js";
import { RateLimiter } from "./RateLimiter.js";
import type {
  OfficialAccountResponse,
  OfficialActiveShardResponse,
  OfficialContentResponse,
  OfficialLeaderboardResponse,
  OfficialMatchlistResponse,
  OfficialMatchResponse,
  OfficialPlatformData,
  OfficialRecentMatchesResponse,
} from "./types.js";

const VALID_SHARDS = new Set(["na", "latam", "br", "eu", "ap", "kr"]);
const AMERICAS_HOST = "https://americas.api.riotgames.com";

export interface OfficialApiOptions {
  limiter?: RateLimiter;
  sleep?: (ms: number) => Promise<void>;
  cache?: FileResponseCache;
}

export class OfficialApi {
  private readonly gateway: HttpGateway;
  private readonly apiKey?: string;
  private readonly limiter: RateLimiter;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly cache?: FileResponseCache;

  constructor(gateway: HttpGateway, apiKey?: string, options: OfficialApiOptions = {}) {
    this.gateway = gateway;
    this.apiKey = apiKey;
    this.limiter = options.limiter ?? new RateLimiter();
    this.sleep =
      options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.cache = options.cache;
  }

  async accountByRiotId(
    gameName: string,
    tagLine: string,
  ): Promise<OfficialAccountResponse | null> {
    const encodedName = encodeURIComponent(gameName);
    const encodedTag = encodeURIComponent(tagLine);
    const url = `${AMERICAS_HOST}/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`;
    return this.request<OfficialAccountResponse>(url, true);
  }

  async accountByPuuid(puuid: string): Promise<OfficialAccountResponse | null> {
    const encodedPuuid = encodeURIComponent(puuid);
    const url = `${AMERICAS_HOST}/riot/account/v1/accounts/by-puuid/${encodedPuuid}`;
    return this.request<OfficialAccountResponse>(url, true);
  }

  async activeShard(puuid: string, game = "val"): Promise<OfficialActiveShardResponse | null> {
    const encodedGame = encodeURIComponent(game);
    const encodedPuuid = encodeURIComponent(puuid);
    const url = `${AMERICAS_HOST}/riot/account/v1/active-shards/by-game/${encodedGame}/by-puuid/${encodedPuuid}`;
    return this.request<OfficialActiveShardResponse>(url, true);
  }

  async matchlist(shard: string, puuid: string): Promise<OfficialMatchlistResponse | null> {
    const validShard = this.validateShard(shard);
    const encodedPuuid = encodeURIComponent(puuid);
    const url = `https://${validShard}.api.riotgames.com/val/match/v1/matchlists/by-puuid/${encodedPuuid}`;
    return this.request<OfficialMatchlistResponse>(url, true);
  }

  async match(shard: string, matchId: string): Promise<OfficialMatchResponse | null> {
    const validShard = this.validateShard(shard);
    const cacheKey = `official:match:${validShard}:${matchId.toLowerCase()}`;

    if (this.cache) {
      const cached = this.cache.get<OfficialMatchResponse>(cacheKey, Infinity);
      if (cached !== undefined) {
        return cached;
      }
    }

    const encodedMatchId = encodeURIComponent(matchId);
    const url = `https://${validShard}.api.riotgames.com/val/match/v1/matches/${encodedMatchId}`;
    const res = await this.request<OfficialMatchResponse>(url, true);
    if (res?.matchInfo?.isCompleted && this.cache) {
      this.cache.set(cacheKey, res);
    }
    return res;
  }

  async recentMatches(shard: string, queue: string): Promise<OfficialRecentMatchesResponse | null> {
    const validShard = this.validateShard(shard);
    const encodedQueue = encodeURIComponent(queue);
    const url = `https://${validShard}.api.riotgames.com/val/match/v1/recent-matches/by-queue/${encodedQueue}`;
    return this.request<OfficialRecentMatchesResponse>(url, true);
  }

  async leaderboard(
    shard: string,
    actId: string,
    options?: { size?: number; startIndex?: number },
  ): Promise<OfficialLeaderboardResponse | null> {
    const validShard = this.validateShard(shard);
    const encodedActId = encodeURIComponent(actId);
    const params = new URLSearchParams();
    if (options?.size !== undefined) params.set("size", String(options.size));
    if (options?.startIndex !== undefined) params.set("startIndex", String(options.startIndex));
    const query = params.toString();
    const base = `https://${validShard}.api.riotgames.com/val/ranked/v1/leaderboards/by-act/${encodedActId}`;
    const url = query ? `${base}?${query}` : base;
    return this.request<OfficialLeaderboardResponse>(url, true);
  }

  async contents(shard: string, locale?: string): Promise<OfficialContentResponse> {
    const validShard = this.validateShard(shard);
    const base = `https://${validShard}.api.riotgames.com/val/content/v1/contents`;
    const url = locale ? `${base}?locale=${encodeURIComponent(locale)}` : base;
    const res = await this.request<OfficialContentResponse>(url, false);
    return res as OfficialContentResponse;
  }

  async platformStatus(shard: string): Promise<OfficialPlatformData> {
    const validShard = this.validateShard(shard);
    const url = `https://${validShard}.api.riotgames.com/val/status/v1/platform-data`;
    const res = await this.request<OfficialPlatformData>(url, false);
    return res as OfficialPlatformData;
  }

  private validateShard(shard: string): string {
    const normalized = shard?.toLowerCase();
    if (!VALID_SHARDS.has(normalized)) {
      throw new ValidationError(
        "invalid-shard",
        `Invalid shard '${shard}'. Allowed shards are na, latam, br, eu, ap, kr`,
        { shard },
      );
    }
    return normalized;
  }

  private ensureApiKey(): string {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new OfficialApiKeyMissingError();
    }
    return this.apiKey;
  }

  private async request<T>(url: string, allowNotFound: boolean): Promise<T | null> {
    const apiKey = this.ensureApiKey();
    const headers = { "X-Riot-Token": apiKey };

    const send = async (): Promise<T> => {
      await this.limiter.acquire();
      return this.gateway.get<T>(url, headers);
    };

    try {
      return await send();
    } catch (error) {
      return this.handleRequestError<T>(error, send, allowNotFound);
    }
  }

  private async handleRequestError<T>(
    error: unknown,
    send: () => Promise<T>,
    allowNotFound: boolean,
  ): Promise<T | null> {
    if (!(error instanceof RiotApiError)) {
      throw error;
    }

    if (allowNotFound && error.status === 404) {
      return null;
    }

    if (error.status === 429) {
      const waitSeconds = Math.min(Math.max(error.retryAfterSeconds ?? 1, 0), 10);
      await this.sleep(waitSeconds * 1000);
      return this.retrySend<T>(send, allowNotFound);
    }

    if (error.status >= 500 && error.status <= 599) {
      await this.sleep(500);
      return this.retrySend<T>(send, allowNotFound);
    }

    throw error;
  }

  private async retrySend<T>(send: () => Promise<T>, allowNotFound: boolean): Promise<T | null> {
    try {
      return await send();
    } catch (retryError) {
      if (allowNotFound && retryError instanceof RiotApiError && retryError.status === 404) {
        return null;
      }
      throw retryError;
    }
  }
}
