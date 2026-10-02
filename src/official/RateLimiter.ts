export interface RateLimiterOptions {
  perSecond?: number;
  perTwoMinutes?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class RateLimiter {
  private readonly perSecond: number;
  private readonly perTwoMinutes: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  private secondTimestamps: number[] = [];
  private twoMinuteTimestamps: number[] = [];
  private chain: Promise<void> = Promise.resolve();

  constructor(options: RateLimiterOptions = {}) {
    this.perSecond = options.perSecond ?? 20;
    this.perTwoMinutes = options.perTwoMinutes ?? 100;
    this.now = options.now ?? (() => Date.now());
    this.sleep =
      options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async acquire(): Promise<void> {
    const next = this.chain.then(async () => {
      await this.waitForSlot();
    });
    this.chain = next.catch(() => {});
    await next;
  }

  private async waitForSlot(): Promise<void> {
    while (true) {
      const currentTime = this.now();
      this.secondTimestamps = this.secondTimestamps.filter((t) => currentTime - t < 1000);
      this.twoMinuteTimestamps = this.twoMinuteTimestamps.filter((t) => currentTime - t < 120_000);

      const waitMs = this.calculateWaitMs(currentTime);
      if (waitMs > 0) {
        await this.sleep(waitMs);
        continue;
      }

      const grantTime = this.now();
      this.secondTimestamps.push(grantTime);
      this.twoMinuteTimestamps.push(grantTime);
      break;
    }
  }

  private calculateWaitMs(currentTime: number): number {
    let waitMs = 0;
    if (this.secondTimestamps.length >= this.perSecond) {
      const waitSecond = this.secondTimestamps[0]! + 1000 - currentTime;
      if (waitSecond > waitMs) {
        waitMs = waitSecond;
      }
    }
    if (this.twoMinuteTimestamps.length >= this.perTwoMinutes) {
      const waitTwoMinute = this.twoMinuteTimestamps[0]! + 120_000 - currentTime;
      if (waitTwoMinute > waitMs) {
        waitMs = waitTwoMinute;
      }
    }
    return waitMs;
  }
}
