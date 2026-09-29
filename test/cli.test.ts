import { describe, expect, it, vi } from "vitest";
import { RiotClient } from "../src/RiotClient.js";
import { AccountService } from "../src/client/AccountService.js";
import { MatchService } from "../src/client/MatchService.js";
import { PartyService } from "../src/client/PartyService.js";
import { SocialService } from "../src/client/SocialService.js";
import { StoreService } from "../src/client/StoreService.js";
import { exitCodeForError, formatError, formatWatchLine, runCli, USAGE } from "../src/cli.js";
import type { RiotEvents, RiotEventMap } from "../src/events/RiotEvents.js";
import { TypedEmitter } from "../src/events/TypedEmitter.js";
import {
  ForbiddenHostError,
  RegionUnknownError,
  RiotApiError,
  RiotClientNotReadyError,
  RiotClientNotRunningError,
  ValidationError,
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

  it("maps ValidationError to exit code 6", () => {
    expect(exitCodeForError(new ValidationError("skin-not-owned"))).toBe(6);
  });

  it("maps ForbiddenHostError and generic errors to exit code 1", () => {
    expect(exitCodeForError(new ForbiddenHostError("evil.com"))).toBe(1);
    expect(exitCodeForError(new Error("Something went wrong"))).toBe(1);
    expect(exitCodeForError("String error")).toBe(1);
  });

  it("formats ValidationError with reason and details", () => {
    const formatted = formatError(
      new ValidationError("skin-not-owned", "Skin is not owned", { skin: "abc" }),
    );
    expect(formatted).toEqual({
      error: {
        code: "VALIDATION",
        reason: "skin-not-owned",
        message: "Skin is not owned",
        details: { skin: "abc" },
      },
    });
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
      expect(output.trim()).toBe("0.2.0");
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
    const friendsSpy = vi.spyOn(SocialService.prototype, "friends").mockResolvedValue([]);
    const requestsSpy = vi.spyOn(SocialService.prototype, "friendRequests").mockResolvedValue([]);
    const blockedSpy = vi.spyOn(SocialService.prototype, "blocked").mockResolvedValue([]);
    const convSpy = vi.spyOn(SocialService.prototype, "conversations").mockResolvedValue([]);
    const msgSpy = vi.spyOn(SocialService.prototype, "messages").mockResolvedValue([]);
    const storeSpy = vi.spyOn(StoreService.prototype, "current").mockResolvedValue({
      player: { puuid: "p", gameName: "P", tagLine: "T", region: "r", shard: "s", accountLevel: 1 },
      fetchedAt: "now",
      daily: null,
      nightMarket: null,
      bundles: null,
      accessories: null,
      radianite: [],
    });
    const matchesSpy = vi.spyOn(MatchService.prototype, "list").mockResolvedValue([]);
    const matchSpy = vi.spyOn(MatchService.prototype, "get").mockResolvedValue({} as never);
    const mmrSpy = vi.spyOn(MatchService.prototype, "mmr").mockResolvedValue({} as never);
    const rankHistorySpy = vi
      .spyOn(MatchService.prototype, "rankHistory")
      .mockResolvedValue([] as never);
    const liveSpy = vi
      .spyOn(MatchService.prototype, "live")
      .mockResolvedValue({ phase: "none" });
    const partySpy = vi.spyOn(PartyService.prototype, "current").mockResolvedValue(null);

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

describe("CLI write commands and dry-run", () => {
  it("defaults to dry-run and prints validated body on equip", async () => {
    let output = "";
    const originalStdout = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    const fakePutBody = { Subject: "p1", Version: 1, Guns: [], ActiveExpressions: [] };
    const validateSpy = vi
      .spyOn(AccountService.prototype, "validateEquip")
      .mockResolvedValue(fakePutBody as never);
    const equipSpy = vi.spyOn(AccountService.prototype, "equip").mockResolvedValue({} as never);
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      const code = await runCli(["equip", "--card", "card-1", "--incognito", "on"]);
      expect(code).toBe(0);
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ card: "card-1", incognito: true }),
      );
      expect(equipSpy).not.toHaveBeenCalled();
      expect(JSON.parse(output.trim())).toEqual(fakePutBody);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("executes write when --yes is passed to equip", async () => {
    let output = "";
    const originalStdout = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    const fakeLoadout = { guns: [], incognito: true };
    const equipSpy = vi
      .spyOn(AccountService.prototype, "equip")
      .mockResolvedValue(fakeLoadout as never);
    const validateSpy = vi.spyOn(AccountService.prototype, "validateEquip");
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      const code = await runCli(["equip", "--card", "card-1", "--yes"]);
      expect(code).toBe(0);
      expect(equipSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy).not.toHaveBeenCalled();
      expect(JSON.parse(output.trim())).toEqual(fakeLoadout);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("outputs exit code 6 and formatted error on ValidationError in equip", async () => {
    let stderrOutput = "";
    const originalStderr = process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      stderrOutput += chunk;
      return true;
    }) as typeof process.stderr.write;

    vi.spyOn(AccountService.prototype, "validateEquip").mockRejectedValue(
      new ValidationError("card-not-owned", "Card not owned", { card: "bad-card" }),
    );
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      const code = await runCli(["equip", "--card", "bad-card"]);
      expect(code).toBe(6);
      const parsed = JSON.parse(stderrOutput.trim());
      expect(parsed).toEqual({
        error: {
          code: "VALIDATION",
          reason: "card-not-owned",
          message: "Card not owned",
          details: { card: "bad-card" },
        },
      });
    } finally {
      process.stderr.write = originalStderr;
      vi.restoreAllMocks();
    }
  });

  it("handles social write commands with dry-run and --yes", async () => {
    const originalStdout = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const valSendSpy = vi
      .spyOn(SocialService.prototype, "validateSendMessage")
      .mockResolvedValue({ cid: "c1", message: "hi", type: "chat" });
    const sendSpy = vi.spyOn(SocialService.prototype, "sendMessage").mockResolvedValue({} as never);

    const valReqSpy = vi
      .spyOn(SocialService.prototype, "validateSendFriendRequest")
      .mockResolvedValue({ game_name: "A", game_tag: "1" });
    const reqSpy = vi
      .spyOn(SocialService.prototype, "sendFriendRequest")
      .mockResolvedValue([] as never);

    const valAcceptSpy = vi
      .spyOn(SocialService.prototype, "validateAcceptFriendRequest")
      .mockResolvedValue({ game_name: "B", game_tag: "2" });
    const acceptSpy = vi
      .spyOn(SocialService.prototype, "acceptFriendRequest")
      .mockResolvedValue([] as never);

    const valDeclineSpy = vi
      .spyOn(SocialService.prototype, "validateDeclineFriendRequest")
      .mockResolvedValue({ puuid: "p1" });
    const declineSpy = vi
      .spyOn(SocialService.prototype, "declineFriendRequest")
      .mockResolvedValue([] as never);

    const valCancelSpy = vi
      .spyOn(SocialService.prototype, "validateCancelFriendRequest")
      .mockResolvedValue({ puuid: "p2" });
    const cancelSpy = vi
      .spyOn(SocialService.prototype, "cancelFriendRequest")
      .mockResolvedValue([] as never);

    const valRemoveSpy = vi
      .spyOn(SocialService.prototype, "validateRemoveFriend")
      .mockResolvedValue({ puuid: "p3" });
    const removeSpy = vi
      .spyOn(SocialService.prototype, "removeFriend")
      .mockResolvedValue([] as never);

    const valBlockSpy = vi
      .spyOn(SocialService.prototype, "validateBlockPlayer")
      .mockResolvedValue({ puuid: "p4" });
    const blockSpy = vi.spyOn(SocialService.prototype, "blockPlayer").mockResolvedValue([] as never);

    const valUnblockSpy = vi
      .spyOn(SocialService.prototype, "validateUnblockPlayer")
      .mockResolvedValue({ puuid: "p5" });
    const unblockSpy = vi
      .spyOn(SocialService.prototype, "unblockPlayer")
      .mockResolvedValue([] as never);

    const valEquipColSpy = vi
      .spyOn(AccountService.prototype, "validateEquipCollection")
      .mockResolvedValue({} as never);
    const equipColSpy = vi
      .spyOn(AccountService.prototype, "equipCollection")
      .mockResolvedValue({} as never);

    try {
      // Dry-runs (no --yes)
      expect(await runCli(["send", "--to", "player#123", "--text", "hello"])).toBe(0);
      expect(valSendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-request", "Bob#999"])).toBe(0);
      expect(valReqSpy).toHaveBeenCalledWith("Bob#999");
      expect(reqSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-accept", "puuid-1"])).toBe(0);
      expect(valAcceptSpy).toHaveBeenCalledWith("puuid-1");
      expect(acceptSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-decline", "puuid-2"])).toBe(0);
      expect(valDeclineSpy).toHaveBeenCalledWith("puuid-2");
      expect(declineSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-cancel", "puuid-3"])).toBe(0);
      expect(valCancelSpy).toHaveBeenCalledWith("puuid-3");
      expect(cancelSpy).not.toHaveBeenCalled();

      expect(await runCli(["friend-remove", "puuid-4"])).toBe(0);
      expect(valRemoveSpy).toHaveBeenCalledWith("puuid-4");
      expect(removeSpy).not.toHaveBeenCalled();

      expect(await runCli(["block", "puuid-5"])).toBe(0);
      expect(valBlockSpy).toHaveBeenCalledWith("puuid-5");
      expect(blockSpy).not.toHaveBeenCalled();

      expect(await runCli(["unblock", "puuid-6"])).toBe(0);
      expect(valUnblockSpy).toHaveBeenCalledWith("puuid-6");
      expect(unblockSpy).not.toHaveBeenCalled();

      expect(await runCli(["equip-collection", "skin-1,skin-2"])).toBe(0);
      expect(valEquipColSpy).toHaveBeenCalledWith(["skin-1", "skin-2"]);
      expect(equipColSpy).not.toHaveBeenCalled();

      // With --yes
      expect(await runCli(["send", "--to", "player#123", "--text", "hello", "--yes"])).toBe(0);
      expect(sendSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["friend-request", "Bob#999", "--yes"])).toBe(0);
      expect(reqSpy).toHaveBeenCalledWith("Bob#999");

      expect(await runCli(["equip-collection", "skin-1,skin-2", "--yes"])).toBe(0);
      expect(equipColSpy).toHaveBeenCalledWith(["skin-1", "skin-2"]);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("handles party write commands with dry-run and --yes", async () => {
    let output = "";
    const originalStdout = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as typeof process.stdout.write;

    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    const valInviteSpy = vi
      .spyOn(PartyService.prototype, "validateInvite")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/invites/name/Bob/tag/1" });
    const inviteSpy = vi.spyOn(PartyService.prototype, "invite").mockResolvedValue({} as never);

    const valKickSpy = vi
      .spyOn(PartyService.prototype, "validateKick")
      .mockResolvedValue({ method: "DELETE", path: "/parties/v1/parties/p1/members/target" });
    const kickSpy = vi.spyOn(PartyService.prototype, "kick").mockResolvedValue({} as never);

    const valPromoteSpy = vi
      .spyOn(PartyService.prototype, "validatePromote")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/members/target/owner" });
    const promoteSpy = vi.spyOn(PartyService.prototype, "promote").mockResolvedValue({} as never);

    const valCreateCodeSpy = vi
      .spyOn(PartyService.prototype, "validateCreateInviteCode")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/invitecode" });
    const createCodeSpy = vi.spyOn(PartyService.prototype, "createInviteCode").mockResolvedValue({} as never);

    const valRevokeCodeSpy = vi
      .spyOn(PartyService.prototype, "validateRevokeInviteCode")
      .mockResolvedValue({ method: "DELETE", path: "/parties/v1/parties/p1/invitecode" });
    const revokeCodeSpy = vi.spyOn(PartyService.prototype, "revokeInviteCode").mockResolvedValue({} as never);

    const valJoinSpy = vi
      .spyOn(PartyService.prototype, "validateJoinByCode")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/players/joinbycode/CODE1" });
    const joinSpy = vi.spyOn(PartyService.prototype, "joinByCode").mockResolvedValue({} as never);

    const valReadySpy = vi
      .spyOn(PartyService.prototype, "validateSetReady")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/members/self/setReady", body: { ready: true } });
    const readySpy = vi.spyOn(PartyService.prototype, "setReady").mockResolvedValue({} as never);

    const valQueueSpy = vi
      .spyOn(PartyService.prototype, "validateSetQueue")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/queue", body: { queueID: "competitive" } });
    const queueSpy = vi.spyOn(PartyService.prototype, "setQueue").mockResolvedValue({} as never);

    const valAccessSpy = vi
      .spyOn(PartyService.prototype, "validateSetAccessibility")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/accessibility", body: { accessibility: "OPEN" } });
    const accessSpy = vi.spyOn(PartyService.prototype, "setAccessibility").mockResolvedValue({} as never);

    const valStartSpy = vi
      .spyOn(PartyService.prototype, "validateStartMatchmaking")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/matchmaking/join" });
    const startSpy = vi.spyOn(PartyService.prototype, "startMatchmaking").mockResolvedValue({} as never);

    const valStopSpy = vi
      .spyOn(PartyService.prototype, "validateStopMatchmaking")
      .mockResolvedValue({ method: "POST", path: "/parties/v1/parties/p1/matchmaking/leave" });
    const stopSpy = vi.spyOn(PartyService.prototype, "stopMatchmaking").mockResolvedValue({} as never);

    const valLeaveSpy = vi
      .spyOn(PartyService.prototype, "validateLeave")
      .mockResolvedValue({ method: "DELETE", path: "/parties/v1/players/self" });
    const leaveSpy = vi.spyOn(PartyService.prototype, "leave").mockResolvedValue({} as never);

    try {
      expect(await runCli(["party-invite", "Bob#1"])).toBe(0);
      expect(valInviteSpy).toHaveBeenCalledWith("Bob#1");
      expect(inviteSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-kick", "target-puuid"])).toBe(0);
      expect(valKickSpy).toHaveBeenCalledWith("target-puuid");
      expect(kickSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-promote", "target-puuid"])).toBe(0);
      expect(valPromoteSpy).toHaveBeenCalledWith("target-puuid");
      expect(promoteSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-code"])).toBe(0);
      expect(valCreateCodeSpy).toHaveBeenCalledTimes(1);
      expect(createCodeSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-code", "--revoke"])).toBe(0);
      expect(valRevokeCodeSpy).toHaveBeenCalledTimes(1);
      expect(revokeCodeSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-join", "CODE1"])).toBe(0);
      expect(valJoinSpy).toHaveBeenCalledWith("CODE1");
      expect(joinSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-ready", "on"])).toBe(0);
      expect(valReadySpy).toHaveBeenCalledWith(true);
      expect(readySpy).not.toHaveBeenCalled();

      output = "";
      expect(await runCli(["party-queue", "competitive"])).toBe(0);
      expect(valQueueSpy).toHaveBeenCalledWith("competitive");
      expect(queueSpy).not.toHaveBeenCalled();
      expect(JSON.parse(output.trim())).toEqual({
        method: "POST",
        path: "/parties/v1/parties/p1/queue",
        body: { queueID: "competitive" },
      });

      expect(await runCli(["party-access", "open"])).toBe(0);
      expect(valAccessSpy).toHaveBeenCalledWith("open");
      expect(accessSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-start"])).toBe(0);
      expect(valStartSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-stop"])).toBe(0);
      expect(valStopSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).not.toHaveBeenCalled();

      expect(await runCli(["party-leave"])).toBe(0);
      expect(valLeaveSpy).toHaveBeenCalledTimes(1);
      expect(leaveSpy).not.toHaveBeenCalled();

      // Executing with --yes
      expect(await runCli(["party-invite", "Bob#1", "--yes"])).toBe(0);
      expect(inviteSpy).toHaveBeenCalledWith("Bob#1");

      expect(await runCli(["party-kick", "target-puuid", "--yes"])).toBe(0);
      expect(kickSpy).toHaveBeenCalledWith("target-puuid");

      expect(await runCli(["party-promote", "target-puuid", "--yes"])).toBe(0);
      expect(promoteSpy).toHaveBeenCalledWith("target-puuid");

      expect(await runCli(["party-code", "--yes"])).toBe(0);
      expect(createCodeSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["party-code", "--revoke", "--yes"])).toBe(0);
      expect(revokeCodeSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["party-join", "CODE1", "--yes"])).toBe(0);
      expect(joinSpy).toHaveBeenCalledWith("CODE1");

      expect(await runCli(["party-ready", "off", "--yes"])).toBe(0);
      expect(readySpy).toHaveBeenCalledWith(false);

      expect(await runCli(["party-queue", "competitive", "--yes"])).toBe(0);
      expect(queueSpy).toHaveBeenCalledWith("competitive");

      expect(await runCli(["party-access", "closed", "--yes"])).toBe(0);
      expect(accessSpy).toHaveBeenCalledWith("closed");

      expect(await runCli(["party-start", "--yes"])).toBe(0);
      expect(startSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["party-stop", "--yes"])).toBe(0);
      expect(stopSpy).toHaveBeenCalledTimes(1);

      expect(await runCli(["party-leave", "--yes"])).toBe(0);
      expect(leaveSpy).toHaveBeenCalledTimes(1);
    } finally {
      process.stdout.write = originalStdout;
      vi.restoreAllMocks();
    }
  });

  it("fails with exit code 6 when missing required arguments for party commands", async () => {
    const originalStderr = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    vi.spyOn(RiotClient.prototype, "close").mockResolvedValue(undefined);

    try {
      expect(await runCli(["party-invite"])).toBe(6);
      expect(await runCli(["party-kick"])).toBe(6);
      expect(await runCli(["party-promote"])).toBe(6);
      expect(await runCli(["party-join"])).toBe(6);
      expect(await runCli(["party-ready"])).toBe(6);
      expect(await runCli(["party-queue"])).toBe(6);
      expect(await runCli(["party-access"])).toBe(6);
    } finally {
      process.stderr.write = originalStderr;
      vi.restoreAllMocks();
    }
  });
});
