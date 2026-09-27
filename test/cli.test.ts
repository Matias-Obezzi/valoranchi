import { describe, expect, it, vi } from "vitest";
import { RiotClient } from "../src/RiotClient.js";
import { exitCodeForError, formatError, runCli, USAGE } from "../src/cli.js";
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

      expect(closeSpy).toHaveBeenCalledTimes(6);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });
});
