import type { Catalogue } from "./catalogue/Catalogue.js";
import { FileCatalogueStore } from "./catalogue/CatalogueStore.js";
import { MemoryCatalogueCache, ValorantApi } from "./catalogue/ValorantApi.js";
import { CollectionBuilder } from "./collection/CollectionBuilder.js";
import { FriendsBuilder } from "./collection/FriendsBuilder.js";
import { LiveMatchBuilder } from "./collection/LiveMatchBuilder.js";
import { LoadoutBuilder } from "./collection/LoadoutBuilder.js";
import { MatchBuilder } from "./collection/MatchBuilder.js";
import { MessagesBuilder } from "./collection/MessagesBuilder.js";
import { MmrBuilder } from "./collection/MmrBuilder.js";
import { PartyBuilder } from "./collection/PartyBuilder.js";
import { StoreBuilder } from "./collection/StoreBuilder.js";
import { RiotClientNotRunningError } from "./errors.js";
import { RiotEvents, toFriendRequest } from "./events/RiotEvents.js";
import { ChatApi } from "./local/ChatApi.js";
import { defaultLockfilePath, readLockfile } from "./local/Lockfile.js";
import { resolveRegion } from "./local/RegionResolver.js";
import { RiotClientLocalApi } from "./local/RiotClientLocalApi.js";
import { RiotSocket } from "./local/RiotSocket.js";
import type {
  BlockedPlayer,
  Conversation,
  Friend,
  FriendRequest,
  LiveMatch,
  Loadout,
  Match,
  MatchSummary,
  Message,
  Mmr,
  OwnedItems,
  Party,
  Player,
  Rank,
  RankChange,
  Store,
  Wallet,
} from "./model/index.js";
import { HttpGateway } from "./riot/HttpGateway.js";
import { RiotApi } from "./riot/RiotApi.js";
import { FileResponseCache } from "./riot/ResponseCache.js";
import { Session } from "./riot/Session.js";
import {
  CURRENCY_UUIDS,
  type RiotAccountXpResponse,
  type RiotMatchHistoryItem,
  type RiotNameResponse,
} from "./riot/types.js";

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
  private cachedEvents: RiotEvents | null = null;

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
    if (this.cachedEvents) {
      this.cachedEvents.stop();
      this.cachedEvents = null;
    }
    if (this.cachedLocalApi) {
      const api = this.cachedLocalApi.api;
      this.cachedLocalApi = null;
      await api.close();
    }
  }

  events(): RiotEvents {
    if (this.cachedEvents) {
      return this.cachedEvents;
    }

    const socket = new RiotSocket(() => {
      const lockfile = readLockfile(this.lockfilePath);
      return lockfile ? { port: lockfile.port, password: lockfile.password } : null;
    });

    const dynamicLocalApi = {
      get: <T>(path: string) => {
        try {
          return this.getLocalApi().get<T>(path);
        } catch {
          return Promise.resolve(null);
        }
      },
    } as unknown as RiotClientLocalApi;

    const chatApi = new ChatApi(dynamicLocalApi);
    const catalogueLoader = () => this.valorantApi.getCatalogue(this.language);
    const puuidResolver = () => this.resolveEventPuuid(chatApi);

    this.cachedEvents = new RiotEvents(socket, chatApi, catalogueLoader, puuidResolver);
    this.cachedEvents.start();
    return this.cachedEvents;
  }

  private async resolveEventPuuid(chatApi: ChatApi): Promise<string | null> {
    try {
      const session = await chatApi.session();
      if (session?.puuid) return session.puuid;
    } catch {}
    try {
      const session = await this.getSession();
      return session.puuid;
    } catch {
      return null;
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
    return rawRequests.map(toFriendRequest);
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

  async matches(options?: { count?: number; queue?: string }): Promise<MatchSummary[]> {
    const session = await this.getSession();
    const api = this.api(session);
    const catalogue = await this.valorantApi.getCatalogue(this.language);

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
    const session = await this.getSession();
    const api = this.api(session);
    const [details, catalogue] = await Promise.all([
      api.matchDetails(id),
      this.valorantApi.getCatalogue(this.language),
    ]);
    return new MatchBuilder(details, catalogue, session.puuid).build();
  }

  async mmr(): Promise<Mmr> {
    const session = await this.getSession();
    const api = this.api(session);
    const [rawMmr, catalogue] = await Promise.all([
      api.mmr(),
      this.valorantApi.getCatalogue(this.language),
    ]);
    return new MmrBuilder(catalogue).buildMmr(rawMmr);
  }

  async rankHistory(options?: { count?: number }): Promise<RankChange[]> {
    const count = Math.max(options?.count ?? 20, 1);
    const session = await this.getSession();
    const api = this.api(session);
    const [rawUpdates, catalogue] = await Promise.all([
      api.competitiveUpdates(0, count, "competitive"),
      this.valorantApi.getCatalogue(this.language),
    ]);
    return new MmrBuilder(catalogue).buildRankChanges(rawUpdates.Matches ?? []);
  }

  async liveMatch(options?: { ranks?: boolean; loadouts?: boolean }): Promise<LiveMatch> {
    const session = await this.getSession();
    const api = this.api(session);
    const catalogue = await this.valorantApi.getCatalogue(this.language);
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
    const session = await this.getSession();
    const api = this.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID) {
      return null;
    }
    const [rawParty, catalogue] = await Promise.all([
      api.party(partyPlayer.CurrentPartyID),
      this.valorantApi.getCatalogue(this.language),
    ]);
    const puuids = (rawParty.Members ?? []).map((m) => m.Subject);
    const names = await this.resolveLobbyNames(api, puuids);
    return new PartyBuilder(catalogue).build(rawParty, names);
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

  private readonly liveRankCache = new Map<string, Rank | null>();

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
