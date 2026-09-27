import type { RiotClientLocalApi } from "./RiotClientLocalApi.js";
import type {
  RawBlockedPlayer,
  RawBlockedResponse,
  RawChatFriend,
  RawChatMessage,
  RawChatPresence,
  RawConversation,
  RawConversationsResponse,
  RawFriendRequest,
  RawFriendRequestsResponse,
  RawFriendsResponse,
  RawMessagesResponse,
  RawPresencesResponse,
  RawChatSession,
} from "./chatTypes.js";

export class ChatApi {
  private readonly localApi: RiotClientLocalApi;

  constructor(localApi: RiotClientLocalApi) {
    this.localApi = localApi;
  }

  async friends(): Promise<RawChatFriend[]> {
    const res = await this.localApi.get<RawFriendsResponse>("/chat/v4/friends");
    return res?.friends ?? [];
  }

  async presences(): Promise<RawChatPresence[]> {
    const res = await this.localApi.get<RawPresencesResponse>("/chat/v4/presences");
    return res?.presences ?? [];
  }

  async friendRequests(): Promise<RawFriendRequest[]> {
    const res = await this.localApi.get<RawFriendRequestsResponse>("/chat/v4/friendrequests");
    return res?.requests ?? [];
  }

  async blocked(): Promise<RawBlockedPlayer[]> {
    const res = await this.localApi.get<RawBlockedResponse>("/chat/v4/blocked");
    return res?.blocked ?? [];
  }

  async conversations(): Promise<RawConversation[]> {
    const read = async (path: string): Promise<RawConversation[]> => {
      try {
        const res = await this.localApi.get<RawConversationsResponse>(path);
        return res?.conversations ?? [];
      } catch {
        return [];
      }
    };

    const results = await Promise.all([
      read("/chat/v6/conversations"),
      read("/chat/v6/conversations/ares-parties"),
      read("/chat/v6/conversations/ares-pregame"),
      read("/chat/v6/conversations/ares-coregame"),
    ]);

    const byCid = new Map<string, RawConversation>();
    for (const list of results) {
      for (const conversation of list) {
        if (conversation?.cid && !byCid.has(conversation.cid)) {
          byCid.set(conversation.cid, conversation);
        }
      }
    }

    return [...byCid.values()];
  }

  async messages(cid?: string): Promise<RawChatMessage[]> {
    const path = cid ? `/chat/v6/messages?cid=${encodeURIComponent(cid)}` : "/chat/v6/messages";
    const res = await this.localApi.get<RawMessagesResponse>(path);
    return res?.messages ?? [];
  }

  async session(): Promise<RawChatSession | null> {
    try {
      const res = await this.localApi.get<RawChatSession>("/chat/v1/session");
      return res ?? null;
    } catch {
      return null;
    }
  }
}
