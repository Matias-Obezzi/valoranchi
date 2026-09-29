import { describe, expect, it } from "vitest";
import { PartyValidator } from "../src/client/PartyValidator.js";
import { ValidationError } from "../src/errors.js";
import type { RiotPartyResponse } from "../src/riot/types.js";

function baseParty(overrides?: Partial<RiotPartyResponse>): RiotPartyResponse {
  return {
    ID: "party-123",
    State: "DEFAULT",
    Accessibility: "CLOSED",
    MatchmakingData: { QueueID: "competitive" },
    EligibleQueues: ["competitive", "unrated", "swiftplay"],
    QueueIneligibilities: [],
    InviteCode: "ABC123DEF",
    RestrictedSeconds: 0,
    Members: [
      { Subject: "owner-puuid", IsOwner: true, IsReady: true },
      { Subject: "member-puuid", IsOwner: false, IsReady: true },
    ],
    ...overrides,
  };
}

describe("PartyValidator", () => {
  it("throws no-party when party is null or has no ID", () => {
    expect(() =>
      PartyValidator.validate(null, "owner-puuid", { type: "create-invite-code" }),
    ).toThrowError(
      expect.objectContaining({
        reason: "no-party",
      }),
    );

    expect(() =>
      PartyValidator.validate({} as RiotPartyResponse, "owner-puuid", {
        type: "create-invite-code",
      }),
    ).toThrowError(
      expect.objectContaining({
        reason: "no-party",
      }),
    );
  });

  it("throws not-a-member when caller is not in party members", () => {
    const party = baseParty();
    expect(() =>
      PartyValidator.validate(party, "stranger-puuid", { type: "set-ready", ready: true }),
    ).toThrowError(
      expect.objectContaining({
        reason: "not-a-member",
      }),
    );
  });

  it("throws not-owner when non-owner attempts owner-only actions", () => {
    const party = baseParty();
    const caller = "member-puuid";

    expect(() =>
      PartyValidator.validate(party, caller, { type: "kick", puuid: "owner-puuid" }),
    ).toThrowError(expect.objectContaining({ reason: "not-owner" }));

    expect(() =>
      PartyValidator.validate(party, caller, { type: "promote", puuid: "owner-puuid" }),
    ).toThrowError(expect.objectContaining({ reason: "not-owner" }));

    expect(() =>
      PartyValidator.validate(party, caller, { type: "create-invite-code" }),
    ).toThrowError(expect.objectContaining({ reason: "not-owner" }));

    expect(() =>
      PartyValidator.validate(party, caller, { type: "revoke-invite-code" }),
    ).toThrowError(expect.objectContaining({ reason: "not-owner" }));

    expect(() =>
      PartyValidator.validate(party, caller, { type: "set-queue", queue: "unrated" }),
    ).toThrowError(expect.objectContaining({ reason: "not-owner" }));

    expect(() =>
      PartyValidator.validate(party, caller, { type: "set-accessibility", accessibility: "open" }),
    ).toThrowError(expect.objectContaining({ reason: "not-owner" }));

    expect(() =>
      PartyValidator.validate(party, caller, { type: "start-matchmaking" }),
    ).toThrowError(expect.objectContaining({ reason: "not-owner" }));

    expect(() =>
      PartyValidator.validate(party, caller, { type: "stop-matchmaking" }),
    ).toThrowError(expect.objectContaining({ reason: "not-owner" }));
  });

  it("throws self-target when owner targets themselves for kick or promote", () => {
    const party = baseParty();
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "kick", puuid: "owner-puuid" }),
    ).toThrowError(expect.objectContaining({ reason: "self-target" }));

    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "promote", puuid: "owner-puuid" }),
    ).toThrowError(expect.objectContaining({ reason: "self-target" }));
  });

  it("throws not-a-member when target of kick or promote is not in party", () => {
    const party = baseParty();
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "kick", puuid: "random-puuid" }),
    ).toThrowError(expect.objectContaining({ reason: "not-a-member" }));

    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "promote", puuid: "random-puuid" }),
    ).toThrowError(expect.objectContaining({ reason: "not-a-member" }));
  });

  it("throws invalid-riot-id for malformed invite targets", () => {
    const party = baseParty();
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "invite", riotId: "nobody" }),
    ).toThrowError(expect.objectContaining({ reason: "invalid-riot-id" }));

    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "invite", riotId: "name#" }),
    ).toThrowError(expect.objectContaining({ reason: "invalid-riot-id" }));

    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "invite", riotId: "#tag" }),
    ).toThrowError(expect.objectContaining({ reason: "invalid-riot-id" }));
  });

  it("throws party-not-idle when party state is not DEFAULT for state-sensitive actions", () => {
    const busyParty = baseParty({ State: "MATCHMAKING" });

    expect(() =>
      PartyValidator.validate(busyParty, "owner-puuid", {
        type: "invite",
        riotId: "Player#123",
      }),
    ).toThrowError(expect.objectContaining({ reason: "party-not-idle" }));

    expect(() =>
      PartyValidator.validate(busyParty, "owner-puuid", {
        type: "set-queue",
        queue: "unrated",
      }),
    ).toThrowError(expect.objectContaining({ reason: "party-not-idle" }));

    expect(() =>
      PartyValidator.validate(busyParty, "owner-puuid", {
        type: "set-accessibility",
        accessibility: "open",
      }),
    ).toThrowError(expect.objectContaining({ reason: "party-not-idle" }));

    expect(() =>
      PartyValidator.validate(busyParty, "owner-puuid", {
        type: "start-matchmaking",
      }),
    ).toThrowError(expect.objectContaining({ reason: "party-not-idle" }));
  });

  it("throws not-matchmaking when stopping matchmaking while not in MATCHMAKING state", () => {
    const party = baseParty({ State: "DEFAULT" });
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "stop-matchmaking" }),
    ).toThrowError(expect.objectContaining({ reason: "not-matchmaking" }));
  });

  it("throws invalid-code for malformed invite codes", () => {
    const party = baseParty();
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "join-by-code", code: "short" }),
    ).toThrowError(expect.objectContaining({ reason: "invalid-code" }));

    expect(() =>
      PartyValidator.validate(party, "owner-puuid", {
        type: "join-by-code",
        code: "toolongcode123456",
      }),
    ).toThrowError(expect.objectContaining({ reason: "invalid-code" }));

    expect(() =>
      PartyValidator.validate(party, "owner-puuid", {
        type: "join-by-code",
        code: "bad code!",
      }),
    ).toThrowError(expect.objectContaining({ reason: "invalid-code" }));
  });

  it("throws already-in-party when joining with current party code", () => {
    const party = baseParty({ InviteCode: "ABC123DEF" });
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", {
        type: "join-by-code",
        code: "abc123def",
      }),
    ).toThrowError(expect.objectContaining({ reason: "already-in-party" }));
  });

  it("throws invite-code-missing when revoking without active invite code", () => {
    const party = baseParty({ InviteCode: null });
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "revoke-invite-code" }),
    ).toThrowError(expect.objectContaining({ reason: "invite-code-missing" }));
  });

  it("throws queue-not-eligible for queues not in EligibleQueues", () => {
    const party = baseParty({ EligibleQueues: ["unrated"] });

    expect(() =>
      PartyValidator.validate(party, "owner-puuid", {
        type: "set-queue",
        queue: "competitive",
      }),
    ).toThrowError(expect.objectContaining({ reason: "queue-not-eligible" }));

    const unrankedParty = baseParty({
      MatchmakingData: { QueueID: "competitive" },
      EligibleQueues: ["unrated"],
    });
    expect(() =>
      PartyValidator.validate(unrankedParty, "owner-puuid", { type: "start-matchmaking" }),
    ).toThrowError(expect.objectContaining({ reason: "queue-not-eligible" }));
  });

  it("throws queue-restricted when party has QueueIneligibilities", () => {
    const party = baseParty({
      QueueIneligibilities: ["RankDisparity"],
    });
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "start-matchmaking" }),
    ).toThrowError(expect.objectContaining({ reason: "queue-restricted" }));
  });

  it("throws restricted when party has RestrictedSeconds > 0", () => {
    const party = baseParty({
      RestrictedSeconds: 120,
    });
    const err = (() => {
      try {
        PartyValidator.validate(party, "owner-puuid", { type: "start-matchmaking" });
        return null;
      } catch (e) {
        return e as ValidationError;
      }
    })();
    expect(err).toBeInstanceOf(ValidationError);
    expect(err?.reason).toBe("restricted");
    expect(err?.details).toEqual({ seconds: 120 });
  });

  it("throws members-not-ready when any member is not ready on matchmaking join", () => {
    const party = baseParty({
      Members: [
        { Subject: "owner-puuid", IsOwner: true, IsReady: true },
        { Subject: "member-puuid", IsOwner: false, IsReady: false },
      ],
    });
    expect(() =>
      PartyValidator.validate(party, "owner-puuid", { type: "start-matchmaking" }),
    ).toThrowError(expect.objectContaining({ reason: "members-not-ready" }));
  });

  describe("happy paths and request shapes", () => {
    const party = baseParty();

    it("validates invite", () => {
      const req = PartyValidator.validate(party, "owner-puuid", {
        type: "invite",
        riotId: "Jett#123",
      });
      expect(req).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/invites/name/Jett/tag/123",
      });
    });

    it("validates kick", () => {
      const req = PartyValidator.validate(party, "owner-puuid", {
        type: "kick",
        puuid: "member-puuid",
      });
      expect(req).toEqual({
        method: "DELETE",
        path: "/parties/v1/parties/party-123/members/member-puuid",
      });
    });

    it("validates promote", () => {
      const req = PartyValidator.validate(party, "owner-puuid", {
        type: "promote",
        puuid: "member-puuid",
      });
      expect(req).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/members/member-puuid/owner",
      });
    });

    it("validates invite code generation and revocation", () => {
      const genReq = PartyValidator.validate(party, "owner-puuid", {
        type: "create-invite-code",
      });
      expect(genReq).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/invitecode",
      });

      const revokeReq = PartyValidator.validate(party, "owner-puuid", {
        type: "revoke-invite-code",
      });
      expect(revokeReq).toEqual({
        method: "DELETE",
        path: "/parties/v1/parties/party-123/invitecode",
      });
    });

    it("validates join by code", () => {
      const req = PartyValidator.validate(party, "owner-puuid", {
        type: "join-by-code",
        code: "NEWCODE123",
      });
      expect(req).toEqual({
        method: "POST",
        path: "/parties/v1/players/joinbycode/NEWCODE123",
      });
    });

    it("validates set ready", () => {
      const req = PartyValidator.validate(party, "member-puuid", {
        type: "set-ready",
        ready: true,
      });
      expect(req).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/members/member-puuid/setReady",
        body: { ready: true },
      });
    });

    it("validates queue change", () => {
      const req = PartyValidator.validate(party, "owner-puuid", {
        type: "set-queue",
        queue: "unrated",
      });
      expect(req).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/queue",
        body: { queueID: "unrated" },
      });
    });

    it("validates accessibility change", () => {
      const openReq = PartyValidator.validate(party, "owner-puuid", {
        type: "set-accessibility",
        accessibility: "open",
      });
      expect(openReq).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/accessibility",
        body: { accessibility: "OPEN" },
      });

      const closedReq = PartyValidator.validate(party, "owner-puuid", {
        type: "set-accessibility",
        accessibility: "closed",
      });
      expect(closedReq).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/accessibility",
        body: { accessibility: "CLOSED" },
      });
    });

    it("validates matchmaking start and stop", () => {
      const startReq = PartyValidator.validate(party, "owner-puuid", {
        type: "start-matchmaking",
      });
      expect(startReq).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/matchmaking/join",
      });

      const mmParty = baseParty({ State: "MATCHMAKING" });
      const stopReq = PartyValidator.validate(mmParty, "owner-puuid", {
        type: "stop-matchmaking",
      });
      expect(stopReq).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/matchmaking/leave",
      });
    });

    it("validates leave party", () => {
      const req = PartyValidator.validate(party, "member-puuid", {
        type: "leave",
      });
      expect(req).toEqual({
        method: "DELETE",
        path: "/parties/v1/players/member-puuid",
      });
    });

    it("allows solo party actions when single member is ready", () => {
      const soloParty = baseParty({
        Members: [{ Subject: "solo-puuid", IsOwner: true, IsReady: true }],
      });
      const req = PartyValidator.validate(soloParty, "solo-puuid", {
        type: "start-matchmaking",
      });
      expect(req).toEqual({
        method: "POST",
        path: "/parties/v1/parties/party-123/matchmaking/join",
      });
    });
  });
});
