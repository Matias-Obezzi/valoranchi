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
} from "../model/index.js";
import type { RiotLoadoutResponse } from "../riot/types.js";
import type { LoadoutChange } from "./LoadoutValidator.js";
import type { PartyActionRequest } from "./PartyValidator.js";

export interface AccountApi {
  whoami(): Promise<Player>;
  ownedItems(options?: { language?: string }): Promise<OwnedItems>;
  loadout(): Promise<Loadout>;
  equip(change: LoadoutChange): Promise<Loadout>;
  validateEquip(change: LoadoutChange): Promise<RiotLoadoutResponse>;
  equipCollection(skinUuids: string[]): Promise<Loadout>;
  validateEquipCollection(skinUuids: string[]): Promise<RiotLoadoutResponse>;
  wallet(): Promise<Wallet>;
}

export interface SocialApi {
  friends(): Promise<Friend[]>;
  friendRequests(): Promise<FriendRequest[]>;
  blocked(): Promise<BlockedPlayer[]>;
  conversations(): Promise<Conversation[]>;
  messages(conversationId?: string): Promise<Message[]>;
  sendMessage(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    text: string,
  ): Promise<Message>;
  validateSendMessage(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    text: string,
  ): Promise<{ cid: string; message: string; type: "chat" | "groupchat" }>;
  sendFriendRequest(riotId: string): Promise<FriendRequest[]>;
  validateSendFriendRequest(riotId: string): Promise<{ game_name: string; game_tag: string }>;
  acceptFriendRequest(puuid: string): Promise<Friend[]>;
  validateAcceptFriendRequest(puuid: string): Promise<{ game_name: string; game_tag: string }>;
  declineFriendRequest(puuid: string): Promise<FriendRequest[]>;
  validateDeclineFriendRequest(puuid: string): Promise<{ puuid: string }>;
  cancelFriendRequest(puuid: string): Promise<FriendRequest[]>;
  validateCancelFriendRequest(puuid: string): Promise<{ puuid: string }>;
  removeFriend(puuid: string): Promise<Friend[]>;
  validateRemoveFriend(puuid: string): Promise<{ puuid: string }>;
  blockPlayer(target: string): Promise<BlockedPlayer[]>;
  validateBlockPlayer(target: string): Promise<{ puuid: string }>;
  unblockPlayer(puuid: string): Promise<BlockedPlayer[]>;
  validateUnblockPlayer(puuid: string): Promise<{ puuid: string }>;
}

export interface StoreApi {
  current(options?: { language?: string }): Promise<Store>;
}

export interface MatchesApi {
  list(options?: { count?: number; queue?: string }): Promise<MatchSummary[]>;
  get(id: string): Promise<Match>;
  mmr(): Promise<Mmr>;
  rankHistory(options?: { count?: number }): Promise<RankChange[]>;
  live(options?: { ranks?: boolean; loadouts?: boolean }): Promise<LiveMatch>;
}

export interface PartyApi {
  current(): Promise<Party>;
  invite(riotId: string): Promise<Party>;
  validateInvite(riotId: string): Promise<PartyActionRequest>;
  kick(puuid: string): Promise<Party>;
  validateKick(puuid: string): Promise<PartyActionRequest>;
  promote(puuid: string): Promise<Party>;
  validatePromote(puuid: string): Promise<PartyActionRequest>;
  createInviteCode(): Promise<Party>;
  validateCreateInviteCode(): Promise<PartyActionRequest>;
  revokeInviteCode(): Promise<Party>;
  validateRevokeInviteCode(): Promise<PartyActionRequest>;
  joinByCode(code: string): Promise<Party>;
  validateJoinByCode(code: string): Promise<PartyActionRequest>;
  setReady(ready: boolean): Promise<Party>;
  validateSetReady(ready: boolean): Promise<PartyActionRequest>;
  setQueue(queue: string): Promise<Party>;
  validateSetQueue(queue: string): Promise<PartyActionRequest>;
  setAccessibility(accessibility: "open" | "closed"): Promise<Party>;
  validateSetAccessibility(accessibility: "open" | "closed"): Promise<PartyActionRequest>;
  startMatchmaking(): Promise<Party>;
  validateStartMatchmaking(): Promise<PartyActionRequest>;
  stopMatchmaking(): Promise<Party>;
  validateStopMatchmaking(): Promise<PartyActionRequest>;
  leave(): Promise<Party>;
  validateLeave(): Promise<PartyActionRequest>;
}
