import type { HttpGateway } from "./HttpGateway.js";
import type { FileResponseCache } from "./ResponseCache.js";
import type { Session } from "./Session.js";
import type {
  RiotAccountXpResponse,
  RiotEntitlementsResponse,
  RiotLoadoutResponse,
  RiotNameResponse,
  RiotWalletResponse,
} from "./types.js";

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

  async names(puuids: string[]): Promise<RiotNameResponse[]> {
    const url = `${this.session.endpoints.pd}/name-service/v2/players`;
    return this.cached(`PUT ${url} ${puuids.join(",")}`, () =>
      this.gateway.put<RiotNameResponse[]>(url, puuids, this.session.headers()),
    );
  }
}
