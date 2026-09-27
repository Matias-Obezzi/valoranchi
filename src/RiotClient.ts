import { FileCatalogueStore } from "./catalogue/CatalogueStore.js";
import { MemoryCatalogueCache, ValorantApi } from "./catalogue/ValorantApi.js";
import { CollectionBuilder } from "./collection/CollectionBuilder.js";
import { FriendsBuilder } from "./collection/FriendsBuilder.js";
import { LoadoutBuilder } from "./collection/LoadoutBuilder.js";
import { MessagesBuilder } from "./collection/MessagesBuilder.js";
import { StoreBuilder } from "./collection/StoreBuilder.js";
import { RiotClientNotRunningError } from "./errors.js";
import { ChatApi } from "./local/ChatApi.js";
import { defaultLockfilePath, readLockfile } from "./local/Lockfile.js";
import { resolveRegion } from "./local/RegionResolver.js";
import { RiotClientLocalApi } from "./local/RiotClientLocalApi.js";
import type {
  BlockedPlayer,
  Conversation,
  Friend,
  FriendRequest,
  Loadout,
  Message,
  OwnedItems,
  Player,
  Store,
  Wallet,
} from "./model/index.js";
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

interface CachedLocalApi {
  port: number;
  password: string;
  api: RiotClientLocalApi;
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
  private cachedLocalApi: CachedLocalApi | null = null;

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

  async close(): Promise<void> {
    if (this.cachedLocalApi) {
      const api = this.cachedLocalApi.api;
      this.cachedLocalApi = null;
      await api.close();
    }
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

  async friends(): Promise<Friend[]> {
    const localApi = this.getLocalApi();
    const chatApi = new ChatApi(localApi);
    const [rawFriends, rawPresences, catalogue] = await Promise.all([
      chatApi.friends(),
      chatApi.presences(),
      this.valorantApi.getCatalogue(this.language),
    ]);
    return new FriendsBuilder(rawFriends, rawPresences, catalogue).build();
  }

  async friendRequests(): Promise<FriendRequest[]> {
    const localApi = this.getLocalApi();
    const rawRequests = await new ChatApi(localApi).friendRequests();
    return rawRequests.map((r) => ({
      puuid: r.puuid,
      gameName: r.game_name,
      tagLine: r.game_tag,
      direction: r.subscription === "pending_in" ? "incoming" : "outgoing",
    }));
  }

  async blocked(): Promise<BlockedPlayer[]> {
    const localApi = this.getLocalApi();
    const rawBlocked = await new ChatApi(localApi).blocked();
    return rawBlocked.map((b) => ({
      puuid: b.puuid,
      gameName: b.game_name,
      tagLine: b.game_tag,
    }));
  }

  async conversations(): Promise<Conversation[]> {
    const localApi = this.getLocalApi();
    const chatApi = new ChatApi(localApi);
    const [rawConversations, friends, session] = await Promise.all([
      chatApi.conversations(),
      this.friends(),
      chatApi.session(),
    ]);
    return new MessagesBuilder(friends, session).buildConversations(rawConversations);
  }

  async messages(conversationId?: string): Promise<Message[]> {
    const localApi = this.getLocalApi();
    const chatApi = new ChatApi(localApi);
    const [rawMessages, friends, session] = await Promise.all([
      chatApi.messages(conversationId),
      this.friends(),
      chatApi.session(),
    ]);
    return new MessagesBuilder(friends, session).buildMessages(rawMessages);
  }

  async store(options?: { language?: string }): Promise<Store> {
    const lang = options?.language ?? this.language;
    const session = await this.getSession();
    const api = this.api(session);

    const [names, accountXp, rawStorefront, catalogue] = await Promise.all([
      api.names([session.puuid]),
      api.accountXp(),
      api.storefront(),
      this.valorantApi.getCatalogue(lang),
    ]);

    const player = this.playerFrom(session, names, accountXp);
    return new StoreBuilder(player, rawStorefront, catalogue, Date.now()).build();
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

    this.inFlightSession = this.createSession()
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

  private getLocalApi(): RiotClientLocalApi {
    const lockfile = readLockfile(this.lockfilePath);
    if (!lockfile) {
      throw new RiotClientNotRunningError();
    }

    if (
      this.cachedLocalApi &&
      this.cachedLocalApi.port === lockfile.port &&
      this.cachedLocalApi.password === lockfile.password
    ) {
      return this.cachedLocalApi.api;
    }

    if (this.cachedLocalApi) {
      void this.cachedLocalApi.api.close();
      this.cachedLocalApi = null;
    }

    const api = this.localApiFactory(lockfile.port, lockfile.password);
    this.cachedLocalApi = {
      port: lockfile.port,
      password: lockfile.password,
      api,
    };
    return api;
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

  private async createSession(): Promise<Session> {
    const localApi = this.getLocalApi();
    const [tokens, regionInfo, clientVersion] = await Promise.all([
      localApi.entitlementsToken(),
      resolveRegion(localApi),
      this.valorantApi.getClientVersion(),
    ]);

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
