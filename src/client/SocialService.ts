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
} from "../model/index.js";
import type { ClientContext } from "./ClientContext.js";

export class SocialService {
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

  async sendMessage(
    to: { puuid: string } | { conversationId: string },
    text: string,
  ): Promise<Message> {
    ChatValidator.validateMessageText(text);
    const chatApi = this.chatApi();
    const [rawFriends, convs, session] = await Promise.all([
      chatApi.friends(),
      this.conversations(),
      chatApi.session(),
    ]);
    const { cid, type } = ChatValidator.validateMessageTarget(to, rawFriends, convs);
    const rawMsg = await chatApi.sendMessage(cid, text, type);
    const isRoom = type === "groupchat";
    const at = rawMsg?.time ? new Date(Number(rawMsg.time)).toISOString() : new Date().toISOString();
    return {
      id: rawMsg?.id || rawMsg?.mid || String(Date.now()),
      conversationId: cid,
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

  async sendFriendRequest(riotId: string): Promise<FriendRequest[]> {
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
    await chatApi.sendFriendRequest(gameName, gameTag);
    return this.friendRequests();
  }

  async acceptFriendRequest(puuid: string): Promise<Friend[]> {
    const chatApi = this.chatApi();
    const rawRequests = await chatApi.friendRequests();
    const { gameName, gameTag } = ChatValidator.validateAcceptFriendRequest(puuid, rawRequests);
    await chatApi.sendFriendRequest(gameName, gameTag);
    return this.friends();
  }

  async declineFriendRequest(puuid: string): Promise<FriendRequest[]> {
    const chatApi = this.chatApi();
    const rawRequests = await chatApi.friendRequests();
    ChatValidator.validateDeclineFriendRequest(puuid, rawRequests);
    await chatApi.deleteFriendRequest(puuid);
    return this.friendRequests();
  }

  async cancelFriendRequest(puuid: string): Promise<FriendRequest[]> {
    const chatApi = this.chatApi();
    const rawRequests = await chatApi.friendRequests();
    ChatValidator.validateCancelFriendRequest(puuid, rawRequests);
    await chatApi.deleteFriendRequest(puuid);
    return this.friendRequests();
  }

  async removeFriend(puuid: string): Promise<Friend[]> {
    const chatApi = this.chatApi();
    const friends = await this.friends();
    ChatValidator.validateRemoveFriend(puuid, friends);
    await chatApi.removeFriend(puuid);
    return this.friends();
  }

  async blockPlayer(target: string): Promise<BlockedPlayer[]> {
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
    await chatApi.blockPlayer(puuid);
    return this.blocked();
  }

  async unblockPlayer(puuid: string): Promise<BlockedPlayer[]> {
    const chatApi = this.chatApi();
    const blocked = await this.blocked();
    ChatValidator.validateUnblockPlayer(puuid, blocked);
    await chatApi.unblockPlayer(puuid);
    return this.blocked();
  }
}
