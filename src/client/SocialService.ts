import { FriendsBuilder } from "../collection/FriendsBuilder.js";
import { MessagesBuilder } from "../collection/MessagesBuilder.js";
import { toFriendRequest } from "../events/RiotEvents.js";
import { ChatApi } from "../local/ChatApi.js";
import { ChatValidator } from "./ChatValidator.js";
import type {
  BlockedPlayer,
  Conversation,
  Friend,
  FriendRequest,
  Message,
  Participant,
} from "../model/index.js";
import type { SocialApi } from "./api.js";
import type { ClientContext } from "./ClientContext.js";

export class SocialService implements SocialApi {
  constructor(private readonly context: ClientContext) {}

  private chatApi(): ChatApi {
    return new ChatApi(this.context.sessions.localApi());
  }

  async friends(): Promise<Friend[]> {
    const chatApi = this.chatApi();
    const [rawFriends, rawPresences, catalogue] = await Promise.all([
      chatApi.friends(),
      chatApi.presences(),
      this.context.catalogue(),
    ]);
    return new FriendsBuilder(rawFriends, rawPresences, catalogue).build();
  }

  async friendRequests(): Promise<FriendRequest[]> {
    const rawRequests = await this.chatApi().friendRequests();
    return rawRequests.map(toFriendRequest);
  }

  async blocked(): Promise<BlockedPlayer[]> {
    const rawBlocked = await this.chatApi().blocked();
    return rawBlocked.map((b) => ({
      puuid: b.puuid,
      gameName: b.game_name,
      tagLine: b.game_tag,
    }));
  }

  async conversations(): Promise<Conversation[]> {
    const chatApi = this.chatApi();
    const [rawConversations, friends, session] = await Promise.all([
      chatApi.conversations(),
      this.friends(),
      chatApi.session(),
    ]);
    return new MessagesBuilder(friends, session).buildConversations(rawConversations);
  }

  async messages(conversationId?: string): Promise<Message[]> {
    const chatApi = this.chatApi();
    const [rawMessages, friends, session] = await Promise.all([
      chatApi.messages(conversationId),
      this.friends(),
      chatApi.session(),
    ]);
    return new MessagesBuilder(friends, session).buildMessages(rawMessages);
  }

  async validateSendMessage(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    text: string,
  ): Promise<{ cid: string; message: string; type: "chat" | "groupchat" }> {
    ChatValidator.validateMessageText(text);
    const chatApi = this.chatApi();
    const [rawFriends, convs] = await Promise.all([
      chatApi.friends(),
      this.conversations(),
    ]);
    const { cid, type } = ChatValidator.validateMessageTarget(to, rawFriends, convs);
    return { cid, message: text, type };
  }

  async sendMessage(
    to: { puuid: string } | { conversationId: string } | { riotId: string },
    text: string,
  ): Promise<Message> {
    const chatApi = this.chatApi();
    const [body, session] = await Promise.all([
      this.validateSendMessage(to, text),
      chatApi.session(),
    ]);
    const rawMsg = await chatApi.sendMessage(body.cid, body.message, body.type);
    const isRoom = body.type === "groupchat";
    const at = rawMsg?.time ? new Date(Number(rawMsg.time)).toISOString() : new Date().toISOString();
    return {
      id: rawMsg?.id || rawMsg?.mid || String(Date.now()),
      conversationId: body.cid,
      from: {
        puuid: session?.puuid ?? "",
        gameName: session?.game_name ?? "",
        tagLine: session?.game_tag ?? "",
      },
      body: text,
      at,
      read: true,
      kind: isRoom ? "room" : "whisper",
    };
  }

  async validateSendFriendRequest(riotId: string): Promise<{ game_name: string; game_tag: string }> {
    const chatApi = this.chatApi();
    const [friends, requests, session] = await Promise.all([
      this.friends(),
      this.friendRequests(),
      chatApi.session(),
    ]);
    const { gameName, gameTag } = ChatValidator.validateFriendRequest(
      riotId,
      { gameName: session?.game_name, tagLine: session?.game_tag },
      friends,
      requests,
    );
    return { game_name: gameName, game_tag: gameTag };
  }

  async sendFriendRequest(riotId: string): Promise<FriendRequest[]> {
    const body = await this.validateSendFriendRequest(riotId);
    await this.chatApi().sendFriendRequest(body.game_name, body.game_tag);
    return this.friendRequests();
  }

  async validateAcceptFriendRequest(puuid: string): Promise<{ game_name: string; game_tag: string }> {
    const chatApi = this.chatApi();
    const rawRequests = await chatApi.friendRequests();
    const { gameName, gameTag } = ChatValidator.validateAcceptFriendRequest(puuid, rawRequests);
    return { game_name: gameName, game_tag: gameTag };
  }

  async acceptFriendRequest(puuid: string): Promise<Friend[]> {
    const body = await this.validateAcceptFriendRequest(puuid);
    await this.chatApi().sendFriendRequest(body.game_name, body.game_tag);
    return this.friends();
  }

  async validateDeclineFriendRequest(puuid: string): Promise<{ puuid: string }> {
    const chatApi = this.chatApi();
    const rawRequests = await chatApi.friendRequests();
    ChatValidator.validateDeclineFriendRequest(puuid, rawRequests);
    return { puuid };
  }

  async declineFriendRequest(puuid: string): Promise<FriendRequest[]> {
    const body = await this.validateDeclineFriendRequest(puuid);
    await this.chatApi().deleteFriendRequest(body.puuid);
    return this.friendRequests();
  }

  async validateCancelFriendRequest(puuid: string): Promise<{ puuid: string }> {
    const chatApi = this.chatApi();
    const rawRequests = await chatApi.friendRequests();
    ChatValidator.validateCancelFriendRequest(puuid, rawRequests);
    return { puuid };
  }

  async cancelFriendRequest(puuid: string): Promise<FriendRequest[]> {
    const body = await this.validateCancelFriendRequest(puuid);
    await this.chatApi().deleteFriendRequest(body.puuid);
    return this.friendRequests();
  }

  async validateRemoveFriend(puuid: string): Promise<{ puuid: string }> {
    const friends = await this.friends();
    ChatValidator.validateRemoveFriend(puuid, friends);
    return { puuid };
  }

  async removeFriend(puuid: string): Promise<Friend[]> {
    const body = await this.validateRemoveFriend(puuid);
    await this.chatApi().removeFriend(body.puuid);
    return this.friends();
  }

  async validateBlockPlayer(target: string): Promise<{ puuid: string }> {
    const chatApi = this.chatApi();
    const [blocked, friends, requests, session] = await Promise.all([
      this.blocked(),
      this.friends(),
      this.friendRequests(),
      chatApi.session(),
    ]);
    const puuid = ChatValidator.validateBlockPlayer(
      target,
      { puuid: session?.puuid, gameName: session?.game_name, tagLine: session?.game_tag },
      blocked,
      friends,
      requests,
    );
    return { puuid };
  }

  async blockPlayer(target: string): Promise<BlockedPlayer[]> {
    const body = await this.validateBlockPlayer(target);
    await this.chatApi().blockPlayer(body.puuid);
    return this.blocked();
  }

  async validateUnblockPlayer(puuid: string): Promise<{ puuid: string }> {
    const blocked = await this.blocked();
    ChatValidator.validateUnblockPlayer(puuid, blocked);
    return { puuid };
  }

  async unblockPlayer(puuid: string): Promise<BlockedPlayer[]> {
    const body = await this.validateUnblockPlayer(puuid);
    await this.chatApi().unblockPlayer(body.puuid);
    return this.blocked();
  }

  async participants(cid?: string): Promise<Participant[]> {
    const raw = await this.chatApi().participants(cid);
    return raw.map((p) => ({
      cid: p.cid ?? "",
      puuid: p.puuid ?? "",
      gameName: p.game_name ?? "",
      tagLine: p.game_tag ?? "",
      name: p.name ?? "",
      pid: p.pid ?? "",
      region: p.region ?? "",
      muted: Boolean(p.muted),
      activePlatform: p.activePlatform ?? null,
    }));
  }
}
