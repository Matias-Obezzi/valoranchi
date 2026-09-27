import { FileCatalogueStore } from "./catalogue/CatalogueStore.js";
import { MemoryCatalogueCache, ValorantApi } from "./catalogue/ValorantApi.js";
import { CollectionBuilder } from "./collection/CollectionBuilder.js";
import { LoadoutBuilder } from "./collection/LoadoutBuilder.js";
import { RiotClientNotRunningError } from "./errors.js";
import { defaultLockfilePath, readLockfile } from "./local/Lockfile.js";
import { resolveRegion } from "./local/RegionResolver.js";
import { RiotClientLocalApi } from "./local/RiotClientLocalApi.js";
import type { Loadout, OwnedItems, Player, Wallet } from "./model/index.js";
import { HttpGateway } from "./riot/HttpGateway.js";
import { RiotApi } from "./riot/RiotApi.js";
import { FileResponseCache } from "./riot/ResponseCache.js";
import { Session } from "./riot/Session.js";
import { CURRENCY_UUIDS, type RiotAccountXpResponse, type RiotNameResponse } from "./riot/types.js";

export interface RiotClientOptions {
  language?: string;
  lockfilePath?: string;
  sessionTtlMs?: number;
  catalogueDir?: string | null;
  responseCache?: { ttlMs: number; dir?: string };
  gateway?: HttpGateway;
  valorantApi?: ValorantApi;
  localApiFactory?: (port: number, pass: string) => RiotClientLocalApi;
}

interface CachedSession {
  port: number;
  password: string;
  session: Session;
  createdAt: number;
}

export class RiotClient {
  private readonly language: string;
  private readonly lockfilePath: string | null;
  private readonly sessionTtlMs: number;
  private readonly gateway: HttpGateway;
  private readonly valorantApi: ValorantApi;
  private readonly responseCache: FileResponseCache | null;
  private readonly localApiFactory: (port: number, pass: string) => RiotClientLocalApi;

  private cachedSession: CachedSession | null = null;
  private inFlightSession: Promise<Session> | null = null;

  constructor(options: RiotClientOptions = {}) {
    this.language = options.language ?? "en-US";
    this.lockfilePath = options.lockfilePath ?? defaultLockfilePath();
    this.sessionTtlMs = options.sessionTtlMs ?? 30_000;
    this.gateway = options.gateway ?? new HttpGateway();
    this.valorantApi = options.valorantApi ?? this.defaultValorantApi(options.catalogueDir);
    this.responseCache = options.responseCache
      ? new FileResponseCache(options.responseCache.ttlMs, options.responseCache.dir)
      : null;
    this.localApiFactory =
      options.localApiFactory ?? ((port, pass) => new RiotClientLocalApi(port, pass));
  }

  async whoami(): Promise<Player> {
    const session = await this.getSession();
    const api = this.api(session);
    const [names, accountXp] = await Promise.all([api.names([session.puuid]), api.accountXp()]);

    return this.playerFrom(session, names, accountXp);
  }

  async ownedItems(options?: { language?: string }): Promise<OwnedItems> {
    const lang = options?.language ?? this.language;
    const session = await this.getSession();
    const api = this.api(session);

    const [names, accountXp, entitlements, catalogue] = await Promise.all([
      api.names([session.puuid]),
      api.accountXp(),
      api.entitlements(),
      this.valorantApi.getCatalogue(lang),
    ]);

    const player = this.playerFrom(session, names, accountXp);
    return new CollectionBuilder(player, entitlements, catalogue, lang).build();
  }

  async loadout(): Promise<Loadout> {
    const session = await this.getSession();
    const api = this.api(session);

    const [names, accountXp, rawLoadout, catalogue] = await Promise.all([
      api.names([session.puuid]),
      api.accountXp(),
      api.loadout(),
      this.valorantApi.getCatalogue(this.language),
    ]);

    const player = this.playerFrom(session, names, accountXp);
    return new LoadoutBuilder(player, rawLoadout, catalogue).build();
  }

  async wallet(): Promise<Wallet> {
    const session = await this.getSession();
    const rawWallet = await this.api(session).wallet();
    const balances = rawWallet.Balances ?? {};

    return {
      valorantPoints: balances[CURRENCY_UUIDS.valorantPoints] ?? 0,
      radianite: balances[CURRENCY_UUIDS.radianite] ?? 0,
      kingdomCredits: balances[CURRENCY_UUIDS.kingdomCredits] ?? 0,
    };
  }

  async getSession(): Promise<Session> {
    const lockfile = readLockfile(this.lockfilePath);
    if (!lockfile) {
      throw new RiotClientNotRunningError();
    }

    if (
      this.cachedSession &&
      this.cachedSession.port === lockfile.port &&
      this.cachedSession.password === lockfile.password &&
      Date.now() - this.cachedSession.createdAt < this.sessionTtlMs
    ) {
      return this.cachedSession.session;
    }

    if (this.inFlightSession) {
      return this.inFlightSession;
    }

    this.inFlightSession = this.createSession(lockfile.port, lockfile.password)
      .then((session) => {
        this.cachedSession = {
          port: lockfile.port,
          password: lockfile.password,
          session,
          createdAt: Date.now(),
        };
        return session;
      })
      .finally(() => {
        this.inFlightSession = null;
      });

    return this.inFlightSession;
  }

  private defaultValorantApi(catalogueDir: string | null | undefined): ValorantApi {
    const store = catalogueDir === null ? null : new FileCatalogueStore(catalogueDir);
    return new ValorantApi(this.gateway, new MemoryCatalogueCache(), store);
  }

  private api(session: Session): RiotApi {
    return new RiotApi(this.gateway, session, this.responseCache);
  }

  private playerFrom(
    session: Session,
    names: RiotNameResponse[],
    accountXp: RiotAccountXpResponse,
  ): Player {
    return {
      puuid: session.puuid,
      gameName: names[0]?.GameName ?? "",
      tagLine: names[0]?.TagLine ?? "",
      region: session.region,
      shard: session.shard,
      accountLevel: accountXp.Progress?.Level ?? 0,
    };
  }

  private async createSession(port: number, pass: string): Promise<Session> {
    const localApi = this.localApiFactory(port, pass);
    const [tokens, regionInfo, clientVersion] = await Promise.all([
      localApi.entitlementsToken(),
      resolveRegion(localApi),
      this.valorantApi.getClientVersion(),
    ]).finally(() => localApi.close());

    return new Session({
      puuid: tokens.subject,
      accessToken: tokens.accessToken,
      entitlementsToken: tokens.token,
      region: regionInfo.region,
      shard: regionInfo.shard,
      clientVersion,
    });
  }
}
