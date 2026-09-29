import { FileCatalogueStore } from "./catalogue/CatalogueStore.js";
import { MemoryCatalogueCache, ValorantApi } from "./catalogue/ValorantApi.js";
import { AccountService } from "./client/AccountService.js";
import { createPlayer, type ClientContext } from "./client/ClientContext.js";
import { EventsService } from "./client/EventsService.js";
import { LiveMatchService } from "./client/LiveMatchService.js";
import { MatchService } from "./client/MatchService.js";
import { SessionManager } from "./client/SessionManager.js";
import { SocialService } from "./client/SocialService.js";
import { StoreService } from "./client/StoreService.js";
import type { RiotEvents } from "./events/RiotEvents.js";
import type { RiotClientLocalApi } from "./local/RiotClientLocalApi.js";
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
  RankChange,
  Store,
  Wallet,
} from "./model/index.js";
import { HttpGateway } from "./riot/HttpGateway.js";
import { FileResponseCache } from "./riot/ResponseCache.js";
import { RiotApi } from "./riot/RiotApi.js";
import type { Session } from "./riot/Session.js";
import type { RiotLoadoutResponse } from "./riot/types.js";

import type { LoadoutChange, LoadoutGunChange } from "./client/LoadoutValidator.js";

export type { LoadoutChange, LoadoutGunChange };

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

export class RiotClient {
  private readonly sessions: SessionManager;
  private readonly accountService: AccountService;
  private readonly socialService: SocialService;
  private readonly storeService: StoreService;
  private readonly matchService: MatchService;
  private readonly liveMatchService: LiveMatchService;
  private readonly eventsService: EventsService;

  constructor(options: RiotClientOptions = {}) {
    const language = options.language ?? "en-US";
    const gateway = options.gateway ?? new HttpGateway();
    const store =
      options.catalogueDir === null ? null : new FileCatalogueStore(options.catalogueDir);
    const valorantApi =
      options.valorantApi ?? new ValorantApi(gateway, new MemoryCatalogueCache(), store);
    const responseCache = options.responseCache
      ? new FileResponseCache(options.responseCache.ttlMs, options.responseCache.dir)
      : null;

    this.sessions = new SessionManager({
      lockfilePath: options.lockfilePath,
      sessionTtlMs: options.sessionTtlMs,
      valorantApi,
      localApiFactory: options.localApiFactory,
    });

    const api = (session: Session) => new RiotApi(gateway, session, responseCache);
    const context: ClientContext = {
      language,
      sessions: this.sessions,
      valorantApi,
      api,
      catalogue: (lang?: string) => valorantApi.getCatalogue(lang ?? language),
      player: (session: Session) => createPlayer(api(session), session),
    };

    this.accountService = new AccountService(context);
    this.socialService = new SocialService(context);
    this.storeService = new StoreService(context);
    this.matchService = new MatchService(context);
    this.liveMatchService = new LiveMatchService(context);
    this.eventsService = new EventsService(context);
  }

  async close(): Promise<void> {
    this.eventsService.close();
    await this.sessions.close();
  }

  events(): RiotEvents {
    return this.eventsService.events();
  }
  async whoami(): Promise<Player> {
    return this.accountService.whoami();
  }
  async ownedItems(options?: { language?: string }): Promise<OwnedItems> {
    return this.accountService.ownedItems(options);
  }
  async loadout(): Promise<Loadout> {
    return this.accountService.loadout();
  }
  async equip(change: LoadoutChange): Promise<Loadout> {
    return this.accountService.equip(change);
  }
  async validateEquip(change: LoadoutChange): Promise<RiotLoadoutResponse> {
    return this.accountService.validateEquip(change);
  }
  async equipCollection(skinUuids: string[]): Promise<Loadout> {
    return this.accountService.equipCollection(skinUuids);
  }
  async validateEquipCollection(skinUuids: string[]): Promise<RiotLoadoutResponse> {
    return this.accountService.validateEquipCollection(skinUuids);
  }
  async wallet(): Promise<Wallet> {
    return this.accountService.wallet();
  }
  async friends(): Promise<Friend[]> {
    return this.socialService.friends();
  }
  async friendRequests(): Promise<FriendRequest[]> {
    return this.socialService.friendRequests();
  }
  async sendFriendRequest(riotId: string): Promise<FriendRequest[]> {
    return this.socialService.sendFriendRequest(riotId);
  }
  async validateSendFriendRequest(riotId: string): Promise<{ game_name: string; game_tag: string }> {
    return this.socialService.validateSendFriendRequest(riotId);
  }
  async acceptFriendRequest(puuid: string): Promise<Friend[]> {
    return this.socialService.acceptFriendRequest(puuid);
  }
  async validateAcceptFriendRequest(puuid: string): Promise<{ game_name: string; game_tag: string }> {
    return this.socialService.validateAcceptFriendRequest(puuid);
  }
  async declineFriendRequest(puuid: string): Promise<FriendRequest[]> {
    return this.socialService.declineFriendRequest(puuid);
  }
  async validateDeclineFriendRequest(puuid: string): Promise<{ puuid: string }> {
    return this.socialService.validateDeclineFriendRequest(puuid);
  }
  async cancelFriendRequest(puuid: string): Promise<FriendRequest[]> {
    return this.socialService.cancelFriendRequest(puuid);
  }
  async validateCancelFriendRequest(puuid: string): Promise<{ puuid: string }> {
    return this.socialService.validateCancelFriendRequest(puuid);
  }
  async removeFriend(puuid: string): Promise<Friend[]> {
    return this.socialService.removeFriend(puuid);
  }
  async validateRemoveFriend(puuid: string): Promise<{ puuid: string }> {
    return this.socialService.validateRemoveFriend(puuid);
  }
  async blocked(): Promise<BlockedPlayer[]> {
    return this.socialService.blocked();
  }
  async blockPlayer(target: string): Promise<BlockedPlayer[]> {
    return this.socialService.blockPlayer(target);
  }
  async validateBlockPlayer(target: string): Promise<{ puuid: string }> {
    return this.socialService.validateBlockPlayer(target);
  }
  async unblockPlayer(puuid: string): Promise<BlockedPlayer[]> {
    return this.socialService.unblockPlayer(puuid);
  }
  async validateUnblockPlayer(puuid: string): Promise<{ puuid: string }> {
    return this.socialService.validateUnblockPlayer(puuid);
  }
  async conversations(): Promise<Conversation[]> {
    return this.socialService.conversations();
  }
  async messages(conversationId?: string): Promise<Message[]> {
    return this.socialService.messages(conversationId);
  }
  async sendMessage(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    text: string,
  ): Promise<Message> {
    return this.socialService.sendMessage(to, text);
  }
  async validateSendMessage(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    text: string,
  ): Promise<{ cid: string; message: string; type: "chat" | "groupchat" }> {
    return this.socialService.validateSendMessage(to, text);
  }
  async store(options?: { language?: string }): Promise<Store> {
    return this.storeService.store(options);
  }
  async matches(options?: { count?: number; queue?: string }): Promise<MatchSummary[]> {
    return this.matchService.matches(options);
  }
  async match(id: string): Promise<Match> {
    return this.matchService.match(id);
  }
  async mmr(): Promise<Mmr> {
    return this.matchService.mmr();
  }
  async rankHistory(options?: { count?: number }): Promise<RankChange[]> {
    return this.matchService.rankHistory(options);
  }
  async liveMatch(options?: { ranks?: boolean; loadouts?: boolean }): Promise<LiveMatch> {
    return this.liveMatchService.liveMatch(options);
  }
  async party(): Promise<Party> {
    return this.liveMatchService.party();
  }
}
