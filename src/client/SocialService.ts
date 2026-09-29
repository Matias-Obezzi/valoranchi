import { FriendsBuilder } from "../collection/FriendsBuilder.js";
import { MessagesBuilder } from "../collection/MessagesBuilder.js";
import { toFriendRequest } from "../events/RiotEvents.js";
import { ChatApi } from "../local/ChatApi.js";
import type { BlockedPlayer, Conversation, Friend, FriendRequest, Message } from "../model/index.js";
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
}
