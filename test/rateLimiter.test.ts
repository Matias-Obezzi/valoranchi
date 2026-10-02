import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/official/RateLimiter.js";

describe("RateLimiter", () => {
  it("allows bursts within per-second limit without sleeping", async () => {
    let nowTime = 1000;
    const sleepCalls: number[] = [];
    const limiter = new RateLimiter({
      perSecond: 3,
      perTwoMinutes: 10,
      now: () => nowTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        nowTime += ms;
      },
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(sleepCalls).toHaveLength(0);
    expect(nowTime).toBe(1000);
  });

  it("delays callers when per-second limit is exceeded", async () => {
    let nowTime = 1000;
    const sleepCalls: number[] = [];
    const limiter = new RateLimiter({
      perSecond: 2,
      perTwoMinutes: 10,
      now: () => nowTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        nowTime += ms;
      },
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(sleepCalls).toEqual([1000]);
    expect(nowTime).toBe(2000);
  });

  it("delays callers when per-two-minutes limit is exceeded", async () => {
    let nowTime = 0;
    const sleepCalls: number[] = [];
    const limiter = new RateLimiter({
      perSecond: 10,
      perTwoMinutes: 2,
      now: () => nowTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        nowTime += ms;
      },
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(sleepCalls).toEqual([120_000]);
    expect(nowTime).toBe(120_000);
  });

  it("serializes concurrent callers so windows hold", async () => {
    let nowTime = 1000;
    const timestamps: number[] = [];
    const limiter = new RateLimiter({
      perSecond: 2,
      perTwoMinutes: 10,
      now: () => nowTime,
      sleep: async (ms) => {
        await Promise.resolve();
        nowTime += ms;
      },
    });

    await Promise.all([
      limiter.acquire().then(() => timestamps.push(nowTime)),
      limiter.acquire().then(() => timestamps.push(nowTime)),
      limiter.acquire().then(() => timestamps.push(nowTime)),
      limiter.acquire().then(() => timestamps.push(nowTime)),
    ]);

    expect(timestamps).toEqual([1000, 1000, 2000, 2000]);
  });
});
