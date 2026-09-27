import type { HttpGateway } from "../riot/HttpGateway.js";
import { Catalogue } from "./Catalogue.js";
import type {
  ValorantApiAgent,
  ValorantApiBuddy,
  ValorantApiContentTier,
  ValorantApiCurrency,
  ValorantApiPlayerCard,
  ValorantApiPlayerTitle,
  ValorantApiSpray,
  ValorantApiWeapon,
} from "./types.js";

interface ApiResponse<T> {
  status: number;
  data: T;
}

interface VersionData {
  riotClientVersion: string;
}

export class MemoryCatalogueCache {
  private clientVersion: string | null = null;
  private readonly catalogues = new Map<string, Catalogue>();

  getVersion(): string | null {
    return this.clientVersion;
  }

  setVersion(version: string): void {
    this.clientVersion = version;
  }

  getCatalogue(language: string): Catalogue | undefined {
    return this.catalogues.get(language);
  }

  setCatalogue(language: string, catalogue: Catalogue): void {
    this.catalogues.set(language, catalogue);
  }

  clear(): void {
    this.clientVersion = null;
    this.catalogues.clear();
  }
}

const GLOBAL_CACHE = new MemoryCatalogueCache();

export class ValorantApi {
  private readonly gateway: HttpGateway;
  private readonly cache: MemoryCatalogueCache;

  constructor(gateway: HttpGateway, cache: MemoryCatalogueCache = GLOBAL_CACHE) {
    this.gateway = gateway;
    this.cache = cache;
  }

  async getClientVersion(): Promise<string> {
    const cached = this.cache.getVersion();
    if (cached) {
      return cached;
    }

    const response = await this.gateway.get<ApiResponse<VersionData>>(
      "https://valorant-api.com/v1/version",
    );
    const version = response.data.riotClientVersion;
    this.cache.setVersion(version);
    return version;
  }

  async getCatalogue(language = "en-US"): Promise<Catalogue> {
    const cached = this.cache.getCatalogue(language);
    if (cached) {
      return cached;
    }

    const [
      weaponsRes,
      playerCardsRes,
      playerTitlesRes,
      spraysRes,
      buddiesRes,
      agentsRes,
      contentTiersRes,
      currenciesRes,
    ] = await Promise.all([
      this.fetchEndpoint<ValorantApiWeapon[]>("weapons", language),
      this.fetchEndpoint<ValorantApiPlayerCard[]>("playerCards", language),
      this.fetchEndpoint<ValorantApiPlayerTitle[]>("playerTitles", language),
      this.fetchEndpoint<ValorantApiSpray[]>("sprays", language),
      this.fetchEndpoint<ValorantApiBuddy[]>("buddies", language),
      this.fetchEndpoint<ValorantApiAgent[]>("agents", language),
      this.fetchEndpoint<ValorantApiContentTier[]>("contentTiers", language),
      this.fetchEndpoint<ValorantApiCurrency[]>("currencies", language),
    ]);

    const catalogue = new Catalogue({
      weapons: weaponsRes.data,
      playerCards: playerCardsRes.data,
      playerTitles: playerTitlesRes.data,
      sprays: spraysRes.data,
      buddies: buddiesRes.data,
      agents: agentsRes.data,
      contentTiers: contentTiersRes.data,
      currencies: currenciesRes.data,
    });

    this.cache.setCatalogue(language, catalogue);
    return catalogue;
  }

  private async fetchEndpoint<T>(endpoint: string, language: string): Promise<ApiResponse<T>> {
    const url = `https://valorant-api.com/v1/${endpoint}?language=${encodeURIComponent(language)}`;
    return this.gateway.get<ApiResponse<T>>(url);
  }
}
