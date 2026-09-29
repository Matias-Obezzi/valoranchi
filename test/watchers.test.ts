import { describe, expect, it, vi } from "vitest";
import { TypedEmitter } from "../src/events/TypedEmitter.js";
import type { RiotEventMap, RiotEvents } from "../src/events/RiotEvents.js";
import type { MatchesApi } from "../src/client/api.js";
import {
  formatPresenceActivity,
  FriendsWatcher,
  MatchWatcher,
} from "../src/watch/index.js";
import type { Friend, LiveMatch, Match, Message, ValorantPresence } from "../src/model/index.js";

function makeFakeEvents(): RiotEvents {
  const emitter = new TypedEmitter<RiotEventMap>();
  const fake = emitter as unknown as RiotEvents;
  fake.start = vi.fn().mockReturnValue(fake);
  fake.stop = vi.fn();
  return fake;
}

function makeFakeLiveMatch(phase: "none" | "pregame" | "ingame", opts?: Partial<LiveMatch>): LiveMatch {
  if (phase === "none") return { phase: "none" };
  return {
    phase,
    matchId: "m-123",
    queue: "competitive",
    ranked: true,
    map: { uuid: "map-1", name: "Ascent", path: "/Game/Maps/Ascent" },
    mode: "bomb",
    phaseEndsInMs: 30000,
    allies: [],
    enemies: [],
    self: {
      puuid: "p-self",
      gameName: "Player",
      tagLine: "NA1",
      incognito: false,
      team: "Blue",
      agent: { uuid: "agent-jett", name: "Jett", icon: { url: "" }, role: "Duelist" },
      selection: "locked",
      accountLevel: 50,
      card: null,
      title: null,
      rank: null,
      partyId: "party-1",
      loadout: null,
      warnings: [],
    },
    ...opts,
  } as LiveMatch;
}

describe("MatchWatcher", () => {
  it("emits pregame and locked when entering pregame", async () => {
    const fakeEvents = makeFakeEvents();
    const liveMatch = makeFakeLiveMatch("pregame");
    const fakeMatches = {
      live: vi.fn().mockResolvedValue(liveMatch),
      get: vi.fn(),
    } as unknown as MatchesApi;

    const watcher = new MatchWatcher(fakeEvents, fakeMatches, { pollIntervalMs: 100 });
    const pregameSpy = vi.fn();
    const lockedSpy = vi.fn();
    watcher.on("pregame", pregameSpy);
    watcher.on("locked", lockedSpy);

    watcher.start();
    fakeEvents.emit("self:state", { state: "pregame", presence: null });

    await vi.waitFor(() => {
      expect(pregameSpy).toHaveBeenCalledTimes(1);
      expect(lockedSpy).toHaveBeenCalledTimes(1);
    });

    watcher.stop();
  });

  it("emits started and round changes during ingame", async () => {
    const fakeEvents = makeFakeEvents();
    const liveMatch = makeFakeLiveMatch("ingame");
    const fakeMatches = {
      live: vi.fn().mockResolvedValue(liveMatch),
      get: vi.fn(),
    } as unknown as MatchesApi;

    const watcher = new MatchWatcher(fakeEvents, fakeMatches, { pollIntervalMs: 100 });
    const startedSpy = vi.fn();
    const roundSpy = vi.fn();
    watcher.on("started", startedSpy);
    watcher.on("round", roundSpy);

    watcher.start();
    fakeEvents.emit("self:state", { state: "ingame", presence: null });

    await vi.waitFor(() => {
      expect(startedSpy).toHaveBeenCalledTimes(1);
    });

    fakeEvents.emit("self:state", {
      state: "ingame",
      presence: { score: { ally: 1, enemy: 0 } } as unknown as ValorantPresence,
    });

    await vi.waitFor(() => {
      expect(roundSpy).toHaveBeenCalledWith({ round: 1, ally: 1, enemy: 0 });
    });

    fakeEvents.emit("self:state", {
      state: "ingame",
      presence: { score: { ally: 1, enemy: 1 } } as unknown as ValorantPresence,
    });

    await vi.waitFor(() => {
      expect(roundSpy).toHaveBeenCalledWith({ round: 2, ally: 1, enemy: 1 });
    });

    watcher.stop();
  });

  it("emits left when leaving pregame to menus", async () => {
    const fakeEvents = makeFakeEvents();
    const liveMatch = makeFakeLiveMatch("pregame");
    const fakeMatches = {
      live: vi.fn().mockResolvedValue(liveMatch),
      get: vi.fn(),
    } as unknown as MatchesApi;

    const watcher = new MatchWatcher(fakeEvents, fakeMatches, { pollIntervalMs: 100 });
    const leftSpy = vi.fn();
    watcher.on("left", leftSpy);

    watcher.start();
    fakeEvents.emit("self:state", { state: "pregame", presence: null });
    fakeEvents.emit("self:state", { state: "menus", presence: null });

    await vi.waitFor(() => {
      expect(leftSpy).toHaveBeenCalledTimes(1);
    });

    watcher.stop();
  });

  it("emits ended when match ends and details are retrieved", async () => {
    const fakeEvents = makeFakeEvents();
    const liveMatch = makeFakeLiveMatch("ingame");
    const fullMatch = { id: "m-123", completed: true } as Match;
    const fakeMatches = {
      live: vi.fn().mockResolvedValue(liveMatch),
      get: vi.fn().mockResolvedValue(fullMatch),
    } as unknown as MatchesApi;

    const watcher = new MatchWatcher(fakeEvents, fakeMatches, {
      pollIntervalMs: 100,
      retryIntervalMs: 50,
    });
    const endedSpy = vi.fn();
    watcher.on("ended", endedSpy);

    watcher.start();
    fakeEvents.emit("game", { phase: "ingame", matchId: "m-123" });
    fakeEvents.emit("self:state", { state: "menus", presence: null });

    await vi.waitFor(() => {
      expect(endedSpy).toHaveBeenCalledWith(fullMatch);
    });

    watcher.stop();
  });

  it("supports async iterator yielding events", async () => {
    const fakeEvents = makeFakeEvents();
    const liveMatch = makeFakeLiveMatch("pregame");
    const fakeMatches = {
      live: vi.fn().mockResolvedValue(liveMatch),
      get: vi.fn(),
    } as unknown as MatchesApi;

    const watcher = new MatchWatcher(fakeEvents, fakeMatches, { pollIntervalMs: 100 });
    const iterator = watcher[Symbol.asyncIterator]();

    fakeEvents.emit("self:state", { state: "pregame", presence: null });

    const first = await iterator.next();
    expect(first.value.event).toBe("pregame");

    const second = await iterator.next();
    expect(second.value.event).toBe("locked");

    watcher.stop();
    const third = await iterator.next();
    expect(third.done).toBe(true);
  });
});

describe("FriendsWatcher", () => {
  it("formats presence activity cleanly", () => {
    expect(
      formatPresenceActivity({
        state: "ingame",
        queue: "competitive",
        map: { name: "Haven", path: "" },
        score: { ally: 5, enemy: 3 },
        party: { id: null, size: 1, max: 5, owner: true },
        competitiveTier: null,
        leaderboardPosition: null,
        accountLevel: null,
        card: null,
        title: null,
      }),
    ).toBe("competitive • Haven • 5-3");

    expect(formatPresenceActivity(null)).toBe("Valorant");
  });

  it("debounces rapid presence bursts to single event", async () => {
    const fakeEvents = makeFakeEvents();
    const watcher = new FriendsWatcher(fakeEvents, { debounceMs: 50 });
    const onlineSpy = vi.fn();
    watcher.on("online", onlineSpy);

    watcher.start();

    const friend: Friend = {
      puuid: "f-1",
      gameName: "Friend",
      tagLine: "NA1",
      note: null,
      group: "VALORANT",
      region: "na",
      lastOnline: null,
      presence: {
        state: "online",
        product: "valorant",
        since: null,
        valorant: null,
      },
    };

    // Burst of 3 presence events within 50ms
    fakeEvents.emit("friend:presence", { friend, change: "update" });
    fakeEvents.emit("friend:presence", { friend, change: "update" });
    fakeEvents.emit("friend:presence", { friend, change: "update" });

    await new Promise((r) => setTimeout(r, 80));

    expect(onlineSpy).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("emits in-game and out-of-game transitions", async () => {
    const fakeEvents = makeFakeEvents();
    const watcher = new FriendsWatcher(fakeEvents, { debounceMs: 20 });
    const inGameSpy = vi.fn();
    const outOfGameSpy = vi.fn();
    watcher.on("in-game", inGameSpy);
    watcher.on("out-of-game", outOfGameSpy);

    watcher.start();

    const friendInGame: Friend = {
      puuid: "f-2",
      gameName: "Gamer",
      tagLine: "EU1",
      note: null,
      group: "VALORANT",
      region: "eu",
      lastOnline: null,
      presence: {
        state: "online",
        product: "valorant",
        since: null,
        valorant: {
          state: "ingame",
          queue: "unrated",
          map: { name: "Bind", path: "" },
          score: null,
          party: { id: null, size: 1, max: 5, owner: true },
          competitiveTier: null,
          leaderboardPosition: null,
          accountLevel: null,
          card: null,
          title: null,
        },
      },
    };

    fakeEvents.emit("friend:presence", { friend: friendInGame, change: "update" });
    await new Promise((r) => setTimeout(r, 40));

    expect(inGameSpy).toHaveBeenCalledTimes(1);
    expect(inGameSpy).toHaveBeenCalledWith({
      friend: friendInGame,
      activity: "unrated • Bind",
    });

    const friendMenus: Friend = {
      ...friendInGame,
      presence: {
        ...friendInGame.presence,
        valorant: {
          ...friendInGame.presence.valorant!,
          state: "menus",
        },
      },
    };

    fakeEvents.emit("friend:presence", { friend: friendMenus, change: "update" });
    await new Promise((r) => setTimeout(r, 40));

    expect(outOfGameSpy).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("emits messages and requests directly", () => {
    const fakeEvents = makeFakeEvents();
    const watcher = new FriendsWatcher(fakeEvents);
    const msgSpy = vi.fn();
    const reqSpy = vi.fn();
    watcher.on("message", msgSpy);
    watcher.on("request", reqSpy);

    watcher.start();

    const message = { id: "m-1", body: "hello" } as Message;
    fakeEvents.emit("message", message);
    expect(msgSpy).toHaveBeenCalledWith(message);

    const req = { puuid: "p-req", gameName: "NewFriend", tagLine: "123", direction: "incoming" as const };
    fakeEvents.emit("friend:request", { request: req, change: "created" });
    expect(reqSpy).toHaveBeenCalledWith(req);

    watcher.stop();
  });
});
