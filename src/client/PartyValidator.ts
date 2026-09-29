import { ValidationError } from "../errors.js";
import type { RiotPartyMember, RiotPartyResponse } from "../riot/types.js";
import { ChatValidator } from "./ChatValidator.js";

export type PartyAction =
  | { type: "invite"; riotId: string }
  | { type: "kick"; puuid: string }
  | { type: "promote"; puuid: string }
  | { type: "create-invite-code" }
  | { type: "revoke-invite-code" }
  | { type: "join-by-code"; code: string }
  | { type: "set-ready"; ready: boolean }
  | { type: "set-queue"; queue: string }
  | { type: "set-accessibility"; accessibility: "open" | "closed" }
  | { type: "start-matchmaking" }
  | { type: "stop-matchmaking" }
  | { type: "leave" };

export interface PartyActionRequest {
  method: "POST" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}

export class PartyValidator {
  static validateActionParameters(action: PartyAction): void {
    if (action.type === "invite") {
      ChatValidator.parseRiotId(action.riotId);
    }
    if (action.type === "join-by-code" && !/^[a-zA-Z0-9]{6,12}$/.test(action.code)) {
      throw new ValidationError(
        "invalid-code",
        "Invite code must be 6 to 12 alphanumeric characters",
        { code: action.code },
      );
    }
  }

  static validate(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
    action: PartyAction,
  ): PartyActionRequest {
    this.validateActionParameters(action);

    if (!party || !party.ID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }

    const selfMember = (party.Members ?? []).find((m) => m.Subject === selfPuuid);
    if (!selfMember) {
      throw new ValidationError("not-a-member", "Caller is not a member of the party", {
        puuid: selfPuuid,
      });
    }

    switch (action.type) {
      case "invite":
        return this.validateInvite(party, action.riotId);
      case "kick":
        return this.validateKick(party, selfMember, action.puuid);
      case "promote":
        return this.validatePromote(party, selfMember, action.puuid);
      case "create-invite-code":
        return this.validateCreateInviteCode(party, selfMember);
      case "revoke-invite-code":
        return this.validateRevokeInviteCode(party, selfMember);
      case "join-by-code":
        return this.validateJoinByCode(party, action.code);
      case "set-ready":
        return this.validateSetReady(party, selfPuuid, action.ready);
      case "set-queue":
        return this.validateSetQueue(party, selfMember, action.queue);
      case "set-accessibility":
        return this.validateSetAccessibility(party, selfMember, action.accessibility);
      case "start-matchmaking":
        return this.validateStartMatchmaking(party, selfMember);
      case "stop-matchmaking":
        return this.validateStopMatchmaking(party, selfMember);
      case "leave":
        return this.validateLeave(selfPuuid);
    }
  }

  private static assertOwner(selfMember: RiotPartyMember): void {
    if (!selfMember.IsOwner) {
      throw new ValidationError("not-owner", "Caller is not the party owner");
    }
  }

  private static assertIdle(party: RiotPartyResponse): void {
    if (party.State !== "DEFAULT") {
      throw new ValidationError("party-not-idle", "Party is not in DEFAULT state", {
        state: party.State,
      });
    }
  }

  private static validateInvite(party: RiotPartyResponse, riotId: string): PartyActionRequest {
    const { gameName, gameTag } = ChatValidator.parseRiotId(riotId);
    this.assertIdle(party);
    return {
      method: "POST",
      path: `/parties/v1/parties/${party.ID}/invites/name/${encodeURIComponent(gameName)}/tag/${encodeURIComponent(gameTag)}`,
    };
  }

  private static validateKick(
    party: RiotPartyResponse,
    selfMember: RiotPartyMember,
    targetPuuid: string,
  ): PartyActionRequest {
    this.assertOwner(selfMember);
    if (targetPuuid === selfMember.Subject) {
      throw new ValidationError("self-target", "Cannot kick yourself from the party", {
        puuid: targetPuuid,
      });
    }
    const exists = party.Members.some((m) => m.Subject === targetPuuid);
    if (!exists) {
      throw new ValidationError("not-a-member", "Player is not a member of the party", {
        puuid: targetPuuid,
      });
    }
    return {
      method: "DELETE",
      path: `/parties/v1/parties/${party.ID}/members/${encodeURIComponent(targetPuuid)}`,
    };
  }

  private static validatePromote(
    party: RiotPartyResponse,
    selfMember: RiotPartyMember,
    targetPuuid: string,
  ): PartyActionRequest {
    this.assertOwner(selfMember);
    if (targetPuuid === selfMember.Subject) {
      throw new ValidationError("self-target", "Cannot promote yourself", {
        puuid: targetPuuid,
      });
    }
    const exists = party.Members.some((m) => m.Subject === targetPuuid);
    if (!exists) {
      throw new ValidationError("not-a-member", "Player is not a member of the party", {
        puuid: targetPuuid,
      });
    }
    return {
      method: "POST",
      path: `/parties/v1/parties/${party.ID}/members/${encodeURIComponent(targetPuuid)}/owner`,
    };
  }

  private static validateCreateInviteCode(
    party: RiotPartyResponse,
    selfMember: RiotPartyMember,
  ): PartyActionRequest {
    this.assertOwner(selfMember);
    return {
      method: "POST",
      path: `/parties/v1/parties/${party.ID}/invitecode`,
    };
  }

  private static validateRevokeInviteCode(
    party: RiotPartyResponse,
    selfMember: RiotPartyMember,
  ): PartyActionRequest {
    this.assertOwner(selfMember);
    if (!party.InviteCode) {
      throw new ValidationError("invite-code-missing", "Party has no active invite code to revoke");
    }
    return {
      method: "DELETE",
      path: `/parties/v1/parties/${party.ID}/invitecode`,
    };
  }

  private static validateJoinByCode(party: RiotPartyResponse, code: string): PartyActionRequest {
    if (!/^[a-zA-Z0-9]{6,12}$/.test(code)) {
      throw new ValidationError(
        "invalid-code",
        "Invite code must be 6 to 12 alphanumeric characters",
        { code },
      );
    }
    if (party.InviteCode && party.InviteCode.toLowerCase() === code.toLowerCase()) {
      throw new ValidationError("already-in-party", "Already in this party", { code });
    }
    return {
      method: "POST",
      path: `/parties/v1/players/joinbycode/${encodeURIComponent(code)}`,
    };
  }

  private static validateSetReady(
    party: RiotPartyResponse,
    selfPuuid: string,
    ready: boolean,
  ): PartyActionRequest {
    return {
      method: "POST",
      path: `/parties/v1/parties/${party.ID}/members/${encodeURIComponent(selfPuuid)}/setReady`,
      body: { ready },
    };
  }

  private static validateSetQueue(
    party: RiotPartyResponse,
    selfMember: RiotPartyMember,
    queue: string,
  ): PartyActionRequest {
    this.assertOwner(selfMember);
    this.assertIdle(party);
    if (party.EligibleQueues) {
      const eligible = party.EligibleQueues.some((q) => q.toLowerCase() === queue.toLowerCase());
      if (!eligible) {
        throw new ValidationError("queue-not-eligible", `Queue '${queue}' is not eligible`, {
          queue,
          eligibleQueues: party.EligibleQueues,
        });
      }
    }
    return {
      method: "POST",
      path: `/parties/v1/parties/${party.ID}/queue`,
      body: { queueID: queue },
    };
  }

  private static validateSetAccessibility(
    party: RiotPartyResponse,
    selfMember: RiotPartyMember,
    accessibility: "open" | "closed",
  ): PartyActionRequest {
    this.assertOwner(selfMember);
    this.assertIdle(party);
    return {
      method: "POST",
      path: `/parties/v1/parties/${party.ID}/accessibility`,
      body: { accessibility: accessibility === "open" ? "OPEN" : "CLOSED" },
    };
  }

  private static validateStartMatchmaking(
    party: RiotPartyResponse,
    selfMember: RiotPartyMember,
  ): PartyActionRequest {
    this.assertOwner(selfMember);
    this.assertIdle(party);

    if (typeof party.RestrictedSeconds === "number" && party.RestrictedSeconds > 0) {
      throw new ValidationError("restricted", "Party is restricted from matchmaking", {
        seconds: party.RestrictedSeconds,
      });
    }

    const currentQueue = party.MatchmakingData?.QueueID;
    if (party.EligibleQueues) {
      if (!currentQueue) {
        throw new ValidationError("queue-not-eligible", "No queue selected for matchmaking");
      }
      const eligible = party.EligibleQueues.some(
        (q) => q.toLowerCase() === currentQueue.toLowerCase(),
      );
      if (!eligible) {
        throw new ValidationError("queue-not-eligible", `Queue '${currentQueue}' is not eligible`, {
          queue: currentQueue,
          eligibleQueues: party.EligibleQueues,
        });
      }
    }

    if (party.QueueIneligibilities && party.QueueIneligibilities.length > 0) {
      throw new ValidationError(
        "queue-restricted",
        "Party is ineligible for matchmaking in current queue",
        { ineligibilities: party.QueueIneligibilities },
      );
    }

    const notReady = (party.Members ?? []).filter((m) => !m.IsReady);
    if (notReady.length > 0) {
      throw new ValidationError(
        "members-not-ready",
        "All party members must be ready to start matchmaking",
        { notReady: notReady.map((m) => m.Subject) },
      );
    }

    return {
      method: "POST",
      path: `/parties/v1/parties/${party.ID}/matchmaking/join`,
    };
  }

  private static validateStopMatchmaking(
    party: RiotPartyResponse,
    selfMember: RiotPartyMember,
  ): PartyActionRequest {
    this.assertOwner(selfMember);
    if (party.State !== "MATCHMAKING") {
      throw new ValidationError("not-matchmaking", "Party is not currently in matchmaking", {
        state: party.State,
      });
    }
    return {
      method: "POST",
      path: `/parties/v1/parties/${party.ID}/matchmaking/leave`,
    };
  }

  private static validateLeave(selfPuuid: string): PartyActionRequest {
    return {
      method: "DELETE",
      path: `/parties/v1/players/${encodeURIComponent(selfPuuid)}`,
    };
  }
}
