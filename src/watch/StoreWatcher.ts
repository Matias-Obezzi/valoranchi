import { wishlistHits } from "../analysis/wishlist.js";
import type { StoreApi } from "../client/api.js";
import { TypedEmitter } from "../events/TypedEmitter.js";
import type { StoreWatchEventMap, StoreWatchItem } from "./types.js";
import { AsyncQueue } from "./AsyncQueue.js";
import { WebhookNotifier } from "./WebhookNotifier.js";

export interface StoreWatcherOptions {
  intervalMs?: number;
  webhook?: string;
}

export class StoreWatcher extends TypedEmitter<StoreWatchEventMap> {
  private readonly intervalMs: number;
  private readonly notifier?: WebhookNotifier;
  private readonly seenKeys = new Set<string>();
  private readonly queues = new Set<AsyncQueue<StoreWatchItem>>();
  private intervalTimer: NodeJS.Timeout | null = null;
  private rotationTimer: NodeJS.Timeout | null = null;
  private lastScheduledEndsAt: string | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private readonly store: StoreApi,
    options: StoreWatcherOptions = {},
  ) {
    super();
    this.intervalMs = options.intervalMs ?? 30 * 60 * 1000;
    if (options.webhook) {
      this.notifier = new WebhookNotifier(options.webhook);
    }
  }

  start(): this {
    if (this.running) return this;
    this.running = true;
    this.stopped = false;

    void this.check();
    this.intervalTimer = setInterval(() => {
      void this.check();
    }, this.intervalMs);

    return this;
  }

  stop(): void {
    if (this.stopped && !this.running) return;
    this.running = false;
    this.stopped = true;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    for (const queue of this.queues) {
      queue.close();
    }
    this.queues.clear();
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<StoreWatchItem> {
    this.start();
    const queue = new AsyncQueue<StoreWatchItem>(() => {
      this.queues.delete(queue);
    });
    this.queues.add(queue);
    return queue;
  }

  async check(): Promise<void> {
    try {
      const [currentStore, wishlist] = await Promise.all([
        this.store.current(),
        this.store.wishlist(),
      ]);
      if (this.stopped) return;

      this.scheduleRotationCheck(currentStore.daily?.endsAt);

      const hits = wishlistHits(currentStore, wishlist);
      for (const hit of hits) {
        const key = `${hit.skin.uuid}:${hit.where}:${hit.endsAt ?? ""}`;
        if (!this.seenKeys.has(key)) {
          this.seenKeys.add(key);
          this.emitItem("hit", hit);
          if (this.notifier) {
            this.notifier.notify(hit).catch((err) => {
              this.emitItem("error", err instanceof Error ? err : new Error(String(err)));
            });
          }
        }
      }
    } catch (err) {
      this.emitItem("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private scheduleRotationCheck(endsAt?: string | null): void {
    if (!endsAt || endsAt === this.lastScheduledEndsAt) {
      return;
    }
    this.lastScheduledEndsAt = endsAt;
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }

    const endsAtMs = new Date(endsAt).getTime();
    const diff = endsAtMs - Date.now() + 1000;
    if (diff > 0 && diff < 2147483647) {
      this.rotationTimer = setTimeout(() => {
        this.rotationTimer = null;
        void this.check();
      }, diff);
    }
  }

  private emitItem<E extends keyof StoreWatchEventMap & string>(
    event: E,
    ...args: StoreWatchEventMap[E]
  ): void {
    this.emit(event, ...args);
    const at = new Date().toISOString();
    const data = args[0] !== undefined ? args[0] : null;
    const item = { event, at, data } as StoreWatchItem;
    for (const q of this.queues) {
      q.push(item);
    }
  }
}
