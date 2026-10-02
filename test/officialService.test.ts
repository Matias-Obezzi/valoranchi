import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Catalogue } from "../src/catalogue/Catalogue.js";
import type { ValorantApiCatalogueData } from "../src/catalogue/types.js";
import type { ClientContext } from "../src/client/ClientContext.js";
import { OfficialService } from "../src/client/OfficialService.js";
import { OfficialApiKeyMissingError, ValidationError } from "../src/errors.js";
import { OfficialApi } from "../src/official/OfficialApi.js";
import type { OfficialMatchResponse } from "../src/official/types.js";
import { HttpGateway } from "../src/riot/HttpGateway.js";

const catalogueData = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "catalogue.json"), "utf-8"),
) as ValorantApiCatalogueData;

function createFakeContext(
  options: {
    officialApiKey?: string;
    cacheDir?: string;
    officialCache?: boolean;
    gateway?: HttpGateway;
  } = {},
): {
  context: ClientContext;
  sessionCalled: () => boolean;
} {
  let sessionAccessCount = 0;
  const catalogue = new Catalogue(catalogueData);

  const fakeSessions = {
    session: vi.fn().mockImplementation(() => {
      sessionAccessCount++;
      throw new Error("sessions.session() must never be called by official service");
    }),
  } as unknown as ClientContext["sessions"];

  const context: ClientContext = {
    language: "en-US",
    sessions: fakeSessions,
    valorantApi: {} as ClientContext["valorantApi"],
    api: () => {
      throw new Error("api() must not be called");
    },
    catalogue: async () => catalogue,
    player: async () => {
      throw new Error("player() must not be called");
    },
    gateway: options.gateway ?? new HttpGateway(),
    officialApiKey: options.officialApiKey,
    cacheDir: options.cacheDir,
    officialCache: options.officialCache,
  };

  return { context, sessionCalled: () => sessionAccessCount > 0 };
}

describe("OfficialService", () => {
  it("throws OfficialApiKeyMissingError when no key is configured", async () => {
    const originalEnv = process.env.RIOT_API_KEY;
    delete process.env.RIOT_API_KEY;
    try {
      const { context } = createFakeContext();
      const service = new OfficialService(context);

      await expect(service.account("Jett#NA1")).rejects.toThrow(OfficialApiKeyMissingError);
      await expect(service.match("m1", { shard: "na" })).rejects.toThrow(
        OfficialApiKeyMissingError,
      );
      await expect(service.matches("Jett#NA1")).rejects.toThrow(OfficialApiKeyMissingError);
      await expect(service.leaderboard({ shard: "na" })).rejects.toThrow(
        OfficialApiKeyMissingError,
      );
      await expect(service.status("na")).rejects.toThrow(OfficialApiKeyMissingError);
    } finally {
      process.env.RIOT_API_KEY = originalEnv;
    }
  });

  it("validates riotId format before calling raw API", async () => {
    const { context } = createFakeContext({ officialApiKey: "test-key" });
    const service = new OfficialService(context);

    await expect(service.account("NoHashTag")).rejects.toThrow(ValidationError);
    await expect(service.matches("InvalidFormat")).rejects.toThrow(ValidationError);
  });

  it("resolves account identity and active shard without touching sessions", async () => {
    const { context, sessionCalled } = createFakeContext({ officialApiKey: "test-key" });
    const rawApi = {
      accountByRiotId: vi.fn().mockResolvedValue({
        puuid: "puuid-123",
        gameName: "Jett",
        tagLine: "NA1",
      }),
      activeShard: vi.fn().mockResolvedValue({
        puuid: "puuid-123",
        game: "val",
        activeShard: "na",
      }),
    } as unknown as OfficialApi;

    const service = new OfficialService(context, rawApi);
    const account = await service.account("Jett#NA1");

    expect(account).toEqual({
      puuid: "puuid-123",
      gameName: "Jett",
      tagLine: "NA1",
      shard: "na",
    });
    expect(sessionCalled()).toBe(false);
  });

  it("filters matches by queue and respects count", async () => {
    const { context } = createFakeContext({ officialApiKey: "test-key" });
    const matchFixture = (id: string, startTime: number): OfficialMatchResponse => ({
      matchInfo: {
        matchId: id,
        mapId: "/Game/Maps/Ascent/Ascent",
        gameLengthMillis: 1000,
        gameStartMillis: startTime,
        isCompleted: true,
        queueId: "competitive",
        isRanked: true,
      },
      players: [
        {
          puuid: "puuid-123",
          gameName: "Jett",
          tagLine: "NA1",
          teamId: "Blue",
          characterId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
        },
      ],
      teams: [{ teamId: "Blue", won: true, roundsPlayed: 1, roundsWon: 1 }],
      roundResults: [],
    });

    const rawApi = {
      accountByRiotId: vi
        .fn()
        .mockResolvedValue({ puuid: "puuid-123", gameName: "Jett", tagLine: "NA1" }),
      activeShard: vi
        .fn()
        .mockResolvedValue({ puuid: "puuid-123", game: "val", activeShard: "na" }),
      matchlist: vi.fn().mockResolvedValue({
        puuid: "puuid-123",
        history: [
          { matchId: "m1", gameStartTimeMillis: 1000, queueId: "competitive" },
          { matchId: "m2", gameStartTimeMillis: 2000, queueId: "unrated" },
          { matchId: "m3", gameStartTimeMillis: 3000, queueId: "competitive" },
        ],
      }),
      match: vi.fn().mockImplementation(async (_shard: string, id: string) => {
        if (id === "m1") return matchFixture("m1", 1000);
        if (id === "m3") return matchFixture("m3", 3000);
        return null;
      }),
    } as unknown as OfficialApi;

    const service = new OfficialService(context, rawApi);
    const summaries = await service.matches("Jett#NA1", { queue: "competitive", count: 1 });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.id).toBe("m3");
  });

  it("fetches single match with self defaulting to first player", async () => {
    const { context } = createFakeContext({ officialApiKey: "test-key" });
    const rawApi = {
      match: vi.fn().mockResolvedValue({
        matchInfo: {
          matchId: "m-detail-1",
          mapId: "/Game/Maps/Ascent/Ascent",
          gameLengthMillis: 5000,
          gameStartMillis: 1700000000000,
          isCompleted: true,
          queueId: "competitive",
          isRanked: true,
        },
        players: [
          {
            puuid: "first-player-puuid",
            gameName: "Player1",
            tagLine: "TAG1",
            teamId: "Blue",
            characterId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
            stats: { score: 100, roundsPlayed: 1, kills: 1, deaths: 0, assists: 0 },
          },
        ],
        teams: [{ teamId: "Blue", won: true, roundsPlayed: 1, roundsWon: 1 }],
        roundResults: [],
      }),
    } as unknown as OfficialApi;

    const service = new OfficialService(context, rawApi);
    const match = await service.match("m-detail-1", { shard: "na" });

    expect(match.id).toBe("m-detail-1");
    expect(match.self).toEqual({ team: "Blue", won: true });
  });

  it("fetches leaderboard with active act from contents if act not provided", async () => {
    const { context } = createFakeContext({ officialApiKey: "test-key" });
    const rawApi = {
      contents: vi.fn().mockResolvedValue({
        version: "release-1",
        acts: [
          { id: "act-inactive", name: "Old Act", isActive: false, type: "act" },
          { id: "act-active-current", name: "Current Act", isActive: true, type: "act" },
        ],
      }),
      leaderboard: vi.fn().mockResolvedValue({
        shard: "na",
        actId: "act-active-current",
        totalPlayers: 1,
        players: [
          {
            puuid: "p1",
            gameName: "Pro",
            tagLine: "123",
            leaderboardRank: 1,
            rankedRating: 500,
            numberOfWins: 50,
            competitiveTier: 27,
          },
        ],
      }),
    } as unknown as OfficialApi;

    const service = new OfficialService(context, rawApi);
    const lb = await service.leaderboard({ shard: "na" });

    expect(rawApi.contents).toHaveBeenCalledWith("na");
    expect(rawApi.leaderboard).toHaveBeenCalledWith("na", "act-active-current", {
      size: 50,
      startIndex: 0,
    });
    expect(lb.season).toBe("act-active-current");
    expect(lb.entries).toHaveLength(1);
  });

  it("fetches completed match once across two instances sharing cache dir, but incomplete match every time", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "official-cache-test-"));
    try {
      const matchCalls: string[] = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/matches/m-completed")) {
          matchCalls.push("completed");
          return new Response(
            JSON.stringify({
              matchInfo: {
                matchId: "m-completed",
                mapId: "/Game/Maps/Ascent/Ascent",
                gameLengthMillis: 5000,
                gameStartMillis: 1700000000000,
                isCompleted: true,
                queueId: "competitive",
                isRanked: true,
              },
              players: [],
              teams: [],
              roundResults: [],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/matches/m-incomplete")) {
          matchCalls.push("incomplete");
          return new Response(
            JSON.stringify({
              matchInfo: {
                matchId: "m-incomplete",
                mapId: "/Game/Maps/Ascent/Ascent",
                gameLengthMillis: 5000,
                gameStartMillis: 1700000000000,
                isCompleted: false,
                queueId: "competitive",
                isRanked: true,
              },
              players: [],
              teams: [],
              roundResults: [],
            }),
            { status: 200 },
          );
        }
        return new Response("Not found", { status: 404 });
      });

      const gateway = new HttpGateway(mockFetch);
      const { context: ctx1 } = createFakeContext({
        officialApiKey: "key",
        cacheDir: tempDir,
        gateway,
      });
      const { context: ctx2 } = createFakeContext({
        officialApiKey: "key",
        cacheDir: tempDir,
        gateway,
      });

      const s1 = new OfficialService(ctx1);
      const s2 = new OfficialService(ctx2);

      const match1 = await s1.match("m-completed", { shard: "na" });
      expect(match1.id).toBe("m-completed");
      const match2 = await s2.match("m-completed", { shard: "na" });
      expect(match2.id).toBe("m-completed");
      expect(matchCalls.filter((c) => c === "completed")).toHaveLength(1);

      const inc1 = await s1.match("m-incomplete", { shard: "na" });
      expect(inc1.id).toBe("m-incomplete");
      const inc2 = await s2.match("m-incomplete", { shard: "na" });
      expect(inc2.id).toBe("m-incomplete");
      expect(matchCalls.filter((c) => c === "incomplete")).toHaveLength(2);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes nothing to disk when officialCache is false", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "official-cache-disabled-"));
    try {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/matches/m-completed")) {
          return new Response(
            JSON.stringify({
              matchInfo: {
                matchId: "m-completed",
                mapId: "/Game/Maps/Ascent/Ascent",
                gameLengthMillis: 5000,
                gameStartMillis: 1700000000000,
                isCompleted: true,
                queueId: "competitive",
                isRanked: true,
              },
              players: [],
              teams: [],
              roundResults: [],
            }),
            { status: 200 },
          );
        }
        return new Response("Not found", { status: 404 });
      });

      const gateway = new HttpGateway(mockFetch);
      const { context } = createFakeContext({
        officialApiKey: "key",
        cacheDir: tempDir,
        officialCache: false,
        gateway,
      });

      const service = new OfficialService(context);
      await service.match("m-completed", { shard: "na" });

      const cacheSubdir = path.join(tempDir, "official");
      const files = fs.existsSync(cacheSubdir) ? fs.readdirSync(cacheSubdir) : [];
      expect(files).toHaveLength(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("summary uses only requested queue and count", async () => {
    const { context } = createFakeContext({ officialApiKey: "test-key" });
    const matchFixture = (id: string, queue: string, startTime: number): OfficialMatchResponse => ({
      matchInfo: {
        matchId: id,
        mapId: "/Game/Maps/Ascent/Ascent",
        gameLengthMillis: 1000,
        gameStartMillis: startTime,
        isCompleted: true,
        queueId: queue,
        isRanked: queue === "competitive",
      },
      players: [
        {
          puuid: "puuid-123",
          gameName: "Jett",
          tagLine: "NA1",
          teamId: "Blue",
          characterId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
          stats: { score: 200, roundsPlayed: 10, kills: 10, deaths: 5, assists: 2 },
        },
      ],
      teams: [{ teamId: "Blue", won: true, roundsPlayed: 10, roundsWon: 10 }],
      roundResults: [],
    });

    const requestedIds: string[] = [];
    const rawApi = {
      accountByRiotId: vi
        .fn()
        .mockResolvedValue({ puuid: "puuid-123", gameName: "Jett", tagLine: "NA1" }),
      activeShard: vi
        .fn()
        .mockResolvedValue({ puuid: "puuid-123", game: "val", activeShard: "na" }),
      matchlist: vi.fn().mockResolvedValue({
        puuid: "puuid-123",
        history: [
          { matchId: "comp-1", gameStartTimeMillis: 1000, queueId: "competitive" },
          { matchId: "comp-2", gameStartTimeMillis: 2000, queueId: "competitive" },
          { matchId: "comp-3", gameStartTimeMillis: 3000, queueId: "competitive" },
          { matchId: "unrated-1", gameStartTimeMillis: 4000, queueId: "unrated" },
        ],
      }),
      match: vi.fn().mockImplementation(async (_shard: string, id: string) => {
        requestedIds.push(id);
        return matchFixture(id, "competitive", 1000);
      }),
    } as unknown as OfficialApi;

    const service = new OfficialService(context, rawApi);
    const summary = await service.summary("Jett#NA1", { queue: "competitive", count: 2 });

    expect(requestedIds).toEqual(["comp-3", "comp-2"]);
    expect(summary.overall.games).toBe(2);
  });

  it("profile takes level and rank from the newest competitive match and returns nulls when there is none", async () => {
    const { context } = createFakeContext({ officialApiKey: "test-key" });
    const matchFixture = (
      id: string,
      queue: string,
      startTime: number,
      tier?: number,
      level?: number,
    ): OfficialMatchResponse => ({
      matchInfo: {
        matchId: id,
        mapId: "/Game/Maps/Ascent/Ascent",
        gameLengthMillis: 1000,
        gameStartMillis: startTime,
        isCompleted: true,
        queueId: queue,
        isRanked: queue === "competitive",
      },
      players: [
        {
          puuid: "puuid-123",
          gameName: "Jett",
          tagLine: "NA1",
          teamId: "Blue",
          characterId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
          competitiveTier: tier,
          accountLevel: level,
          stats: { score: 100, roundsPlayed: 5, kills: 5, deaths: 2, assists: 1 },
        },
      ],
      teams: [{ teamId: "Blue", won: true, roundsPlayed: 5, roundsWon: 5 }],
      roundResults: [],
    });

    const rawApiWithComp = {
      accountByRiotId: vi
        .fn()
        .mockResolvedValue({ puuid: "puuid-123", gameName: "Jett", tagLine: "NA1" }),
      activeShard: vi
        .fn()
        .mockResolvedValue({ puuid: "puuid-123", game: "val", activeShard: "na" }),
      matchlist: vi.fn().mockResolvedValue({
        puuid: "puuid-123",
        history: [
          { matchId: "m-old-comp", gameStartTimeMillis: 1000, queueId: "competitive" },
          { matchId: "m-new-comp", gameStartTimeMillis: 2000, queueId: "competitive" },
          { matchId: "m-newest-unrated", gameStartTimeMillis: 3000, queueId: "unrated" },
        ],
      }),
      match: vi.fn().mockImplementation(async (_shard: string, id: string) => {
        if (id === "m-newest-unrated") return matchFixture("m-newest-unrated", "unrated", 3000);
        if (id === "m-new-comp") return matchFixture("m-new-comp", "competitive", 2000, 15, 45);
        if (id === "m-old-comp") return matchFixture("m-old-comp", "competitive", 1000, 14, 44);
        return null;
      }),
    } as unknown as OfficialApi;

    const serviceWithComp = new OfficialService(context, rawApiWithComp);
    const profile = await serviceWithComp.profile("Jett#NA1", { count: 3 });

    expect(profile.account).toEqual({
      puuid: "puuid-123",
      gameName: "Jett",
      tagLine: "NA1",
      shard: "na",
    });
    expect(profile.accountLevel).toBe(45);
    expect(profile.rank?.tier).toBe(15);
    expect(profile.lastPlayedAt).toBe(new Date(3000).toISOString());
    expect(profile.summary.overall.games).toBe(3);

    const rawApiNoComp = {
      accountByRiotId: vi
        .fn()
        .mockResolvedValue({ puuid: "puuid-123", gameName: "Jett", tagLine: "NA1" }),
      activeShard: vi
        .fn()
        .mockResolvedValue({ puuid: "puuid-123", game: "val", activeShard: "na" }),
      matchlist: vi.fn().mockResolvedValue({
        puuid: "puuid-123",
        history: [{ matchId: "unrated-1", gameStartTimeMillis: 5000, queueId: "unrated" }],
      }),
      match: vi.fn().mockImplementation(async (_shard: string, id: string) => {
        return matchFixture(id, "unrated", 5000);
      }),
    } as unknown as OfficialApi;

    const serviceNoComp = new OfficialService(context, rawApiNoComp);
    const profileNoComp = await serviceNoComp.profile("Jett#NA1");

    expect(profileNoComp.accountLevel).toBeNull();
    expect(profileNoComp.rank).toBeNull();
    expect(profileNoComp.lastPlayedAt).toBe(new Date(5000).toISOString());
    expect(profileNoComp.summary.overall.games).toBe(1);
  });
});
