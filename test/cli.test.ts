import { describe, expect, it, vi } from "vitest";
import { RiotClient } from "../src/RiotClient.js";
import { exitCodeForError, formatError, formatWatchLine, runCli, USAGE } from "../src/cli.js";
import type { RiotEvents, RiotEventMap } from "../src/events/RiotEvents.js";
import { TypedEmitter } from "../src/events/TypedEmitter.js";
import {
  ForbiddenHostError,
  RegionUnknownError,
  RiotApiError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
} from "../src/errors.js";

describe("CLI error mapping", () => {
  it("maps RiotClientNotRunningError to exit code 2", () => {
    expect(exitCodeForError(new RiotClientNotRunningError())).toBe(2);
  });

  it("maps RiotClientNotReadyError to exit code 3", () => {
    expect(exitCodeForError(new RiotClientNotReadyError())).toBe(3);
  });

  it("maps RegionUnknownError to exit code 4", () => {
    expect(exitCodeForError(new RegionUnknownError())).toBe(4);
  });

  it("maps RiotApiError to exit code 5", () => {
    expect(exitCodeForError(new RiotApiError(500, "https://pd.na.a.pvp.net"))).toBe(5);
  });

  it("maps ForbiddenHostError and generic errors to exit code 1", () => {
    expect(exitCodeForError(new ForbiddenHostError("evil.com"))).toBe(1);
    expect(exitCodeForError(new Error("Something went wrong"))).toBe(1);
    expect(exitCodeForError("String error")).toBe(1);
  });

  it("formats errors matching { error: { code, message } }", () => {
    const formatted = formatError(new RiotClientNotRunningError("Client offline"));
    expect(formatted).toEqual({
      error: {
        code: "RIOT_CLIENT_NOT_RUNNING",
        message: "Client offline",
      },
    });

    const unknownFormatted = formatError(new Error("Generic failure"));
    expect(unknownFormatted).toEqual({
      error: {
        code: "UNKNOWN_ERROR",
        message: "Generic failure",
      },
    });
  });
});

describe("CLI entrypoint and flags", () => {
  it("prints version and exits 0 on --version", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await runCli(["--version"]);
      expect(code).toBe(0);
      expect(output.trim()).toBe("0.1.0");
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("prints USAGE and exits 0 on --help", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await runCli(["--help"]);
      expect(code).toBe(0);
      expect(output).toBe(USAGE);
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("dispatches all commands to RiotClient and calls close() in finally", async () => {
    const originalStdout = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;

    const closeSpy = vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);
    const friendsSpy = vi.spyOn(RiotClient.prototype, "friends").mockResolvedValue([]);
    const requestsSpy = vi.spyOn(RiotClient.prototype, "friendRequests").mockResolvedValue([]);
    const blockedSpy = vi.spyOn(RiotClient.prototype, "blocked").mockResolvedValue([]);
    const convSpy = vi.spyOn(RiotClient.prototype, "conversations").mockResolvedValue([]);
    const msgSpy = vi.spyOn(RiotClient.prototype, "messages").mockResolvedValue([]);
    const storeSpy = vi.spyOn(RiotClient.prototype, "store").mockResolvedValue({
      player: { puuid: "p", gameName: "P", tagLine: "T", region: "r", shard: "s", accountLevel: 1 },
      fetchedAt: "now",
      daily: null,
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    });
    const matchesSpy = vi.spyOn(RiotClient.prototype, "matches").mockResolvedValue([]);
    const matchSpy = vi.spyOn(RiotClient.prototype, "match").mockResolvedValue({} as never);
    const mmrSpy = vi.spyOn(RiotClient.prototype, "mmr").mockResolvedValue({} as never);
    const rankHistorySpy = vi
      .spyOn(RiotClient.prototype, "rankHistory")
      .mockResolvedValue([] as never);
    const liveSpy = vi
      .spyOn(RiotClient.prototype, "liveMatch")
      .mockResolvedValue({ phase: "none" });
    const partySpy = vi.spyOn(RiotClient.prototype, "party").mockResolvedValue(null);

    try {
      expect(await runCli(["friends"])).toBe(0);
      expect(friendsSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["friend-requests"])).toBe(0);
      expect(requestsSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["blocked"])).toBe(0);
      expect(blockedSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["conversations"])).toBe(0);
      expect(convSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["messages", "--cid", "room-123"])).toBe(0);
      expect(msgSpy).toHaveBeenCalledWith("room-123");

      expect(await runCli(["store"])).toBe(0);
      expect(storeSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["matches", "--count", "5", "--queue", "competitive"])).toBe(0);
      expect(matchesSpy).toHaveBeenCalledWith({ count: 5, queue: "competitive" });

      expect(await runCli(["match", "match-uuid-1"])).toBe(0);
      expect(matchSpy).toHaveBeenCalledWith("match-uuid-1");

      expect(await runCli(["mmr"])).toBe(0);
      expect(mmrSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["rank-history", "--count", "3"])).toBe(0);
      expect(rankHistorySpy).toHaveBeenCalledWith({ count: 3 });

      expect(await runCli(["live", "--ranks", "--no-loadouts"])).toBe(0);
      expect(liveSpy).toHaveBeenCalledWith({ ranks: true, loadouts: false });

      expect(await runCli(["party"])).toBe(0);
      expect(partySpy).toHaveBeenCalledTimes(1);

      expect(closeSpy).toHaveBeenCalledTimes(12);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("handles missing match ID with an error", async () => {
    const originalStderr = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      const code = await runCli(["match"]);
      expect(code).toBe(1);
    } finally {
      process.stderr.write = originalStderr;
    }
  });
});

describe("CLI watch command", () => {
  it("formats line matching { event, at, data }", () => {
    const fixedIso = "2026-09-29T12:00:00.000Z";
    const line = formatWatchLine("connected", undefined, fixedIso);
    expect(line).toBe('{"event":"connected","at":"2026-09-29T12:00:00.000Z","data":null}');

    const lineWithData = formatWatchLine("party", { partyId: "p1" }, fixedIso);
    expect(lineWithData).toBe(
      '{"event":"party","at":"2026-09-29T12:00:00.000Z","data":{"partyId":"p1"}}',
    );
  });

  it("streams events as JSON lines and exits 0 on SIGINT", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    const fakeEmitter = new TypedEmitter<RiotEventMap>();
    vi.spyOn(RiotClient.prototype, "events").mockReturnValue(fakeEmitter as unknown as RiotEvents);
    const closeSpy = vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const promise = runCli(["watch", "--only", "connected,party"]);

    fakeEmitter.emit("connected");
    fakeEmitter.emit("party", { partyId: "party-99" });
    fakeEmitter.emit("game", { phase: "pregame", matchId: "m1" });

    process.emit("SIGINT");
    const code = await promise;

    process.stdout.write = originalWrite;
    expect(code).toBe(0);
    expect(closeSpy).toHaveBeenCalled();

    const lines = output
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { event: string; data: unknown });
    expect(lines).toHaveLength(2);
    expect(lines[0]!.event).toBe("connected");
    expect(lines[1]!.event).toBe("party");
    expect(lines[1]!.data).toEqual({ partyId: "party-99" });
  });

  it("filters out raw events unless --raw flag is passed", async () => {
    let output = "";
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    const fakeEmitter = new TypedEmitter<RiotEventMap>();
    vi.spyOn(RiotClient.prototype, "events").mockReturnValue(fakeEmitter as unknown as RiotEvents);
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const promise = runCli(["watch"]);
    fakeEmitter.emit("raw", { uri: "/foo", eventType: "Create", data: {} });
    fakeEmitter.emit("party", { partyId: "p1" });

    process.emit("SIGTERM");
    await promise;

    process.stdout.write = originalWrite;
    const lines = output
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { event: string });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.event).toBe("party");
  });
});
