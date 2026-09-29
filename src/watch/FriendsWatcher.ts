import type { RiotEvents } from "../events/RiotEvents.js";
import { TypedEmitter } from "../events/TypedEmitter.js";
import type { Friend, FriendRequest, Message, ValorantPresence } from "../model/index.js";
import { AsyncQueue } from "./AsyncQueue.js";
import type { FriendsWatchEventMap, FriendsWatchItem } from "./types.js";

export interface FriendsWatcherOptions {
  debounceMs?: number;
}

export function formatPresenceActivity(val: ValorantPresence | null | undefined): string {
  if (!val) return "Valorant";
  const parts: string[] = [];
  if (val.queue) parts.push(val.queue);
  if (val.map?.name) parts.push(val.map.name);
  else if (val.map?.path) parts.push(val.map.path);
  if (val.score) parts.push(`${val.score.ally}-${val.score.enemy}`);
  return parts.length > 0 ? parts.join(" • ") : "In Game";
}

export class FriendsWatcher extends TypedEmitter<FriendsWatchEventMap> {
  private readonly debounceMs: number;
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingFriends = new Map<
    string,
    { friend: Friend; change: "update" | "offline" }
  >();
  private readonly lastKnown = new Map<
    string,
    { online: boolean; inGame: boolean; activity: string }
  >();
  private readonly queues = new Set<AsyncQueue<FriendsWatchItem>>();
  private running = false;
  private unsubListeners: Array<() => void> = [];

  constructor(
    private readonly events: RiotEvents,
    options: FriendsWatcherOptions = {},
  ) {
    super();
    this.debounceMs = options.debounceMs ?? 300;
  }

  start(): this {
    if (this.running) return this;
    this.running = true;
    this.events.start();

    const onPresence = (data: { friend: Friend; change: "update" | "offline" }) => {
      this.handleFriendPresence(data.friend, data.change);
    };

    const onMessage = (msg: Message) => {
      this.emitItem("message", msg);
    };

    const onRequest = (data: { request: FriendRequest; change: "created" | "resolved" }) => {
      if (data.change === "created") {
        this.emitItem("request", data.request);
      }
    };

    const onError = (err: Error) => {
      this.emitItem("error", err);
    };

    this.events.on("friend:presence", onPresence);
    this.events.on("message", onMessage);
    this.events.on("friend:request", onRequest);
    this.events.on("error", onError);

    this.unsubListeners.push(
      () => this.events.off("friend:presence", onPresence),
      () => this.events.off("message", onMessage),
      () => this.events.off("friend:request", onRequest),
      () => this.events.off("error", onError),
    );

    return this;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingFriends.clear();

    for (const unsub of this.unsubListeners) {
      unsub();
    }
    this.unsubListeners = [];

    for (const queue of this.queues) {
      queue.close();
    }
    this.queues.clear();
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<FriendsWatchItem> {
    this.start();
    const queue = new AsyncQueue<FriendsWatchItem>(() => {
      this.queues.delete(queue);
    });
    this.queues.add(queue);
    return queue;
  }

  private emitItem<E extends keyof FriendsWatchEventMap & string>(
    event: E,
    ...args: FriendsWatchEventMap[E]
  ): void {
    this.emit(event, ...args);
    const at = new Date().toISOString();
    const data = args[0] !== undefined ? args[0] : null;
    const item = { event, at, data } as FriendsWatchItem;
    for (const q of this.queues) {
      q.push(item);
    }
  }

  private handleFriendPresence(friend: Friend, change: "update" | "offline"): void {
    const puuid = friend.puuid;
    if (this.debounceTimers.has(puuid)) {
      clearTimeout(this.debounceTimers.get(puuid)!);
    }

    this.pendingFriends.set(puuid, { friend, change });

    const timer = setTimeout(() => {
      this.debounceTimers.delete(puuid);
      const pending = this.pendingFriends.get(puuid);
      this.pendingFriends.delete(puuid);
      if (pending && this.running) {
        this.processFriendPresence(pending.friend, pending.change);
      }
    }, this.debounceMs);

    this.debounceTimers.set(puuid, timer);
  }

  private processFriendPresence(friend: Friend, change: "update" | "offline"): void {
    const isOffline = change === "offline" || friend.presence.state === "offline";
    const online = !isOffline;
    const inGame = online && friend.presence.valorant?.state === "ingame";
    const activity = inGame ? formatPresenceActivity(friend.presence.valorant) : "";
    const prev = this.lastKnown.get(friend.puuid);
    this.lastKnown.set(friend.puuid, { online, inGame, activity });

    if (!prev) {
      if (online) {
        this.emitItem("online", friend);
        if (inGame) {
          this.emitItem("in-game", { friend, activity });
        }
      } else {
        this.emitItem("offline", friend);
      }
      return;
    }

    if (!prev.online && online) {
      this.emitItem("online", friend);
      if (inGame) {
        this.emitItem("in-game", { friend, activity });
      }
    } else if (prev.online && !online) {
      if (prev.inGame) {
        this.emitItem("out-of-game", friend);
      }
      this.emitItem("offline", friend);
    } else if (online) {
      if (!prev.inGame && inGame) {
        this.emitItem("in-game", { friend, activity });
      } else if (prev.inGame && !inGame) {
        this.emitItem("out-of-game", friend);
      } else if (prev.inGame && inGame && prev.activity !== activity) {
        this.emitItem("in-game", { friend, activity });
      }
    }
  }
}
