import type {
  Friend,
  FriendRequest,
  LiveMatch,
  Match,
  Message,
  WishlistHit,
} from "../model/index.js";

export type MatchWatchEventMap = {
  pregame: [match: LiveMatch];
  locked: [match: LiveMatch];
  started: [match: LiveMatch];
  round: [data: { round: number; ally: number; enemy: number }];
  ended: [match: Match];
  left: [];
  error: [error: Error];
};

export type MatchWatchItem =
  | { event: "pregame"; at: string; data: LiveMatch }
  | { event: "locked"; at: string; data: LiveMatch }
  | { event: "started"; at: string; data: LiveMatch }
  | { event: "round"; at: string; data: { round: number; ally: number; enemy: number } }
  | { event: "ended"; at: string; data: Match }
  | { event: "left"; at: string; data: null }
  | { event: "error"; at: string; data: { message: string; name?: string } };

export type FriendsWatchEventMap = {
  online: [friend: Friend];
  offline: [friend: Friend];
  "in-game": [data: { friend: Friend; activity: string }];
  "out-of-game": [friend: Friend];
  message: [message: Message];
  request: [request: FriendRequest];
  error: [error: Error];
};

export type FriendsWatchItem =
  | { event: "online"; at: string; data: Friend }
  | { event: "offline"; at: string; data: Friend }
  | { event: "in-game"; at: string; data: { friend: Friend; activity: string } }
  | { event: "out-of-game"; at: string; data: Friend }
  | { event: "message"; at: string; data: Message }
  | { event: "request"; at: string; data: FriendRequest }
  | { event: "error"; at: string; data: { message: string; name?: string } };

export type StoreWatchEventMap = {
  hit: [hit: WishlistHit];
  error: [error: Error];
};

export type StoreWatchItem =
  | { event: "hit"; at: string; data: WishlistHit }
  | { event: "error"; at: string; data: { message: string; name?: string } };
