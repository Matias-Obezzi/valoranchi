export interface RawChatFriend {
  puuid: string;
  game_name: string;
  game_tag: string;
  name: string;
  note: string | null;
  pid: string;
  region: string;
  group: string;
  displayGroup: string;
  activePlatform: string | null;
  last_online_ts: number | null;
}

export interface RawFriendsResponse {
  friends?: RawChatFriend[];
}

export interface RawChatPresence {
  puuid: string;
  game_name: string;
  game_tag: string;
  pid: string;
  product: string;
  state: string;
  private: string | null;
  time: number | string;
}

export interface RawPresencesResponse {
  presences?: RawChatPresence[];
}

export interface RawFriendRequest {
  puuid: string;
  game_name: string;
  game_tag: string;
  name: string;
  note: string | null;
  pid: string;
  region: string;
  subscription: "pending_in" | "pending_out" | string;
}

export interface RawFriendRequestsResponse {
  requests?: RawFriendRequest[];
}

export interface RawBlockedPlayer {
  puuid: string;
  game_name: string;
  game_tag: string;
  name: string;
  note?: string | null;
  pid?: string;
  region?: string;
  group?: string;
  displayGroup?: string;
  activePlatform?: string | null;
  last_online_ts?: number | null;
}

export interface RawBlockedResponse {
  blocked?: RawBlockedPlayer[];
}

export interface RawConversation {
  cid: string;
  type: string;
  direct_messages?: boolean;
  global_readership?: boolean;
  muted?: boolean;
  unread_count?: number;
  mid?: string;
}

export interface RawConversationsResponse {
  conversations?: RawConversation[];
}

export interface RawChatMessage {
  id: string;
  mid?: string;
  cid: string;
  puuid: string;
  game_name: string;
  game_tag: string;
  name: string;
  pid: string;
  region: string;
  body: string;
  read: boolean;
  time: string;
  type: string;
}

export interface RawMessagesResponse {
  messages?: RawChatMessage[];
}
