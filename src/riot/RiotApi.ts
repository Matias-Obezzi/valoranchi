import type { HttpGateway } from "./HttpGateway.js";
import type { FileResponseCache } from "./ResponseCache.js";
import type { Session } from "./Session.js";
import type {
  RiotAccountXpResponse,
  RiotCompetitiveUpdatesResponse,
  RiotCoreGameLoadoutsResponse,
  RiotCoreGameMatchResponse,
  RiotCoreGamePlayerResponse,
  RiotEntitlementsResponse,
  RiotLoadoutResponse,
  RiotMatchDetailsResponse,
  RiotMatchHistoryResponse,
  RiotMmrResponse,
  RiotNameResponse,
  RiotPartyPlayerResponse,
  RiotPartyResponse,
  RiotPregameMatchResponse,
  RiotPregamePlayerResponse,
  RiotStorefrontResponse,
  RiotWalletResponse,
} from "./types.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class RiotApi {
  private readonly gateway: HttpGateway;
  private readonly session: Session;
  private readonly cache: FileResponseCache | null;

  constructor(gateway: HttpGateway, session: Session, cache: FileResponseCache | null = null) {
    this.gateway = gateway;
    this.session = session;
    this.cache = cache;
  }

  private get<T>(url: string): Promise<T> {
    return this.cached(`GET ${url}`, () => this.gateway.get<T>(url, this.session.headers()));
  }

  private cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    return this.cache ? this.cache.through(`${this.session.puuid} ${key}`, fetcher) : fetcher();
  }

  async entitlements(): Promise<RiotEntitlementsResponse> {
    return this.get(`${this.session.endpoints.pd}/store/v1/entitlements/${this.session.puuid}`);
  }

  async loadout(): Promise<RiotLoadoutResponse> {
    return this.get(
      `${this.session.endpoints.pd}/personalization/v3/players/${this.session.puuid}/playerloadout`,
    );
  }

  async accountXp(): Promise<RiotAccountXpResponse> {
    return this.get(`${this.session.endpoints.pd}/account-xp/v1/players/${this.session.puuid}`);
  }

  async wallet(): Promise<RiotWalletResponse> {
    return this.get(`${this.session.endpoints.pd}/store/v1/wallet/${this.session.puuid}`);
  }

  async storefront(): Promise<RiotStorefrontResponse> {
    const url = `${this.session.endpoints.pd}/store/v3/storefront/${this.session.puuid}`;
    return this.cached(`POST ${url}`, () =>
      this.gateway.post<RiotStorefrontResponse>(url, {}, this.session.headers()),
    );
  }

  async names(puuids: string[]): Promise<RiotNameResponse[]> {
    const url = `${this.session.endpoints.pd}/name-service/v2/players`;
    return this.cached(`PUT ${url} ${puuids.join(",")}`, () =>
      this.gateway.put<RiotNameResponse[]>(url, puuids, this.session.headers()),
    );
  }

  async matchHistory(
    startIndex = 0,
    endIndex = 20,
    queue?: string,
  ): Promise<RiotMatchHistoryResponse> {
    const queueParam = queue ? `&queue=${encodeURIComponent(queue)}` : "";
    const url = `${this.session.endpoints.pd}/match-history/v1/history/${this.session.puuid}?startIndex=${startIndex}&endIndex=${endIndex}${queueParam}`;
    return this.get(url);
  }

  async matchDetails(matchId: string): Promise<RiotMatchDetailsResponse> {
    const url = `${this.session.endpoints.pd}/match-details/v1/matches/${matchId}`;
    const fetcher = () => this.gateway.get<RiotMatchDetailsResponse>(url, this.session.headers());
    return this.cache
      ? this.cache.through(`matchDetails ${matchId}`, fetcher, { ttlMs: THIRTY_DAYS_MS })
      : fetcher();
  }

  async mmr(puuid = this.session.puuid): Promise<RiotMmrResponse> {
    return this.get(`${this.session.endpoints.pd}/mmr/v1/players/${puuid}`);
  }

  async competitiveUpdates(
    startIndex = 0,
    endIndex = 20,
    queue = "competitive",
  ): Promise<RiotCompetitiveUpdatesResponse> {
    const url = `${this.session.endpoints.pd}/mmr/v1/players/${this.session.puuid}/competitiveupdates?startIndex=${startIndex}&endIndex=${endIndex}&queue=${encodeURIComponent(queue)}`;
    return this.get(url);
  }

  async pregamePlayer(): Promise<RiotPregamePlayerResponse | null> {
    const url = `${this.session.endpoints.glz}/pregame/v1/players/${this.session.puuid}`;
    return this.gateway.getOrNull(url, this.session.headers());
  }

  async pregameMatch(id: string): Promise<RiotPregameMatchResponse> {
    const url = `${this.session.endpoints.glz}/pregame/v1/matches/${id}`;
    return this.gateway.get(url, this.session.headers());
  }

  async coreGamePlayer(): Promise<RiotCoreGamePlayerResponse | null> {
    const url = `${this.session.endpoints.glz}/core-game/v1/players/${this.session.puuid}`;
    return this.gateway.getOrNull(url, this.session.headers());
  }

  async coreGameMatch(id: string): Promise<RiotCoreGameMatchResponse> {
    const url = `${this.session.endpoints.glz}/core-game/v1/matches/${id}`;
    return this.gateway.get(url, this.session.headers());
  }

  async coreGameLoadouts(id: string): Promise<RiotCoreGameLoadoutsResponse> {
    const url = `${this.session.endpoints.glz}/core-game/v1/matches/${id}/loadouts`;
    return this.gateway.get(url, this.session.headers());
  }

  async partyPlayer(): Promise<RiotPartyPlayerResponse | null> {
    const url = `${this.session.endpoints.glz}/parties/v1/players/${this.session.puuid}`;
    return this.gateway.getOrNull(url, this.session.headers());
  }

  async party(id: string): Promise<RiotPartyResponse> {
    const url = `${this.session.endpoints.glz}/parties/v1/parties/${id}`;
    return this.gateway.get(url, this.session.headers());
  }
}
