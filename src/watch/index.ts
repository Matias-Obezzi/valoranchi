import type { MatchesApi } from "../client/api.js";
import type { RiotEvents } from "../events/RiotEvents.js";
import { FriendsWatcher, type FriendsWatcherOptions } from "./FriendsWatcher.js";
import { MatchWatcher, type MatchWatcherOptions } from "./MatchWatcher.js";

export { FriendsWatcher, formatPresenceActivity, type FriendsWatcherOptions } from "./FriendsWatcher.js";
export { MatchWatcher, type MatchWatcherOptions } from "./MatchWatcher.js";
export { AsyncQueue } from "./AsyncQueue.js";
export type {
  FriendsWatchEventMap,
  FriendsWatchItem,
  MatchWatchEventMap,
  MatchWatchItem,
} from "./types.js";

export interface WatchApi {
  match(options?: MatchWatcherOptions): MatchWatcher;
  friends(options?: FriendsWatcherOptions): FriendsWatcher;
}

export class WatchService implements WatchApi {
  constructor(
    private readonly eventsProvider: () => RiotEvents,
    private readonly matches: MatchesApi,
  ) {}

  match(options?: MatchWatcherOptions): MatchWatcher {
    return new MatchWatcher(this.eventsProvider(), this.matches, options);
  }

  friends(options?: FriendsWatcherOptions): FriendsWatcher {
    return new FriendsWatcher(this.eventsProvider(), options);
  }
}
