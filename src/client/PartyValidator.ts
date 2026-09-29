import type { Catalogue } from "../catalogue/Catalogue.js";
import { ValidationError } from "../errors.js";
import type { CustomGameSettings } from "../model/index.js";
import type {
  RiotCustomGameConfigsResponse,
  RiotPartyMember,
  RiotPartyPlayerResponse,
  RiotPartyResponse,
} from "../riot/types.js";
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

  static validateJoin(
    playerRecord: RiotPartyPlayerResponse | null | undefined,
    partyId: string,
  ): { partyId: string } {
    const invite = playerRecord?.Invites?.find(
      (i) => i.PartyID?.toLowerCase() === partyId.toLowerCase(),
    );
    if (!invite) {
      throw new ValidationError("invite-missing", `No invite found for party ${partyId}`, {
        partyId,
      });
    }
    return { partyId: invite.PartyID };
  }

  static validateDeclineInvite(
    playerRecord: RiotPartyPlayerResponse | null | undefined,
    inviteId: string,
  ): { partyId: string; inviteId: string } {
    const invite = playerRecord?.Invites?.find((i) => i.ID === inviteId);
    if (!invite) {
      throw new ValidationError("invite-missing", `Invite ${inviteId} not found`, { inviteId });
    }
    return { partyId: invite.PartyID, inviteId };
  }

  static validateDeclineRequest(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
    requestId: string,
  ): { partyId: string; requestId: string } {
    if (!party || !party.ID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }
    const selfMember = (party.Members ?? []).find((m) => m.Subject === selfPuuid);
    if (!selfMember) {
      throw new ValidationError("not-a-member", "Caller is not a member of the party");
    }
    const req = party.Requests?.find((r) => r.ID === requestId);
    if (!req) {
      throw new ValidationError("request-missing", `Request ${requestId} not found`, { requestId });
    }
    return { partyId: party.ID, requestId };
  }

  static validateCustomGame(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
  ): RiotPartyMember {
    if (!party || !party.ID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }
    const selfMember = (party.Members ?? []).find((m) => m.Subject === selfPuuid);
    if (!selfMember) {
      throw new ValidationError("not-a-member", "Caller is not a member of the party");
    }
    const isCustom =
      party.State === "CUSTOM_GAME" || party.MatchmakingData?.QueueID?.toLowerCase() === "custom";
    if (!isCustom) {
      throw new ValidationError("not-custom-game", "Party is not in custom game mode");
    }
    return selfMember;
  }

  static validateSetCustomGameSettings(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
    settings: CustomGameSettings,
    configs: RiotCustomGameConfigsResponse,
    catalogue: Catalogue,
  ): Record<string, unknown> {
    const selfMember = this.validateCustomGame(party, selfPuuid);
    this.assertOwner(selfMember);

    let mapPath = settings.map;
    if (mapPath) {
      const match = configs.EnabledMaps.find(
        (p) =>
          p.toLowerCase() === mapPath.toLowerCase() ||
          catalogue.getMapByPath(p)?.displayName.toLowerCase() === mapPath.toLowerCase() ||
          catalogue.findMap(mapPath)?.mapUrl.toLowerCase() === p.toLowerCase(),
      );
      if (!match) {
        throw new ValidationError("map-not-enabled", `Map '${settings.map}' is not enabled`, {
          map: settings.map,
        });
      }
      mapPath = match;
    }

    let modePath = settings.mode;
    if (modePath) {
      const match = configs.EnabledModes.find(
        (p) =>
          p.toLowerCase() === modePath.toLowerCase() ||
          p.toLowerCase().includes(modePath.toLowerCase()),
      );
      if (!match) {
        throw new ValidationError("mode-not-enabled", `Mode '${settings.mode}' is not enabled`, {
          mode: settings.mode,
        });
      }
      modePath = match;
    }

    if (settings.server) {
      const pods = configs.GamePodPingServiceInfo as Record<string, unknown> | undefined;
      const valid =
        pods && Object.keys(pods).some((k) => k.toLowerCase() === settings.server!.toLowerCase());
      if (!valid) {
        throw new ValidationError("server-unknown", `Server '${settings.server}' is unknown`, {
          server: settings.server,
        });
      }
    }

    return {
      Map: mapPath,
      Mode: modePath,
      UseBots: false,
      GamePod: settings.server ?? "",
      GameRules: settings.rules ?? {},
    };
  }

  static validateSetTeam(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
    targetPuuid: string,
    team: string,
  ): { partyId: string; team: string; puuid: string } {
    this.validateCustomGame(party, selfPuuid);
    const normalizedTeam = normalizeCustomGameTeam(team);
    const exists = party!.Members.some((m) => m.Subject === targetPuuid);
    if (!exists) {
      throw new ValidationError("not-a-member", "Player is not a member of the party", {
        puuid: targetPuuid,
      });
    }
    return { partyId: party!.ID, team: normalizedTeam, puuid: targetPuuid };
  }

  static validateStartCustomGame(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
  ): { partyId: string } {
    const selfMember = this.validateCustomGame(party, selfPuuid);
    this.assertOwner(selfMember);
    const membership = party!.CustomGameData?.Membership;
    const teamOneCount = membership?.TeamOne?.length ?? 0;
    const teamTwoCount = membership?.TeamTwo?.length ?? 0;
    if (teamOneCount + teamTwoCount === 0) {
      throw new ValidationError(
        "no-team-players",
        "At least one player must be on a team to start a custom game",
      );
    }
    return { partyId: party!.ID };
  }

  static validateBalanceTeams(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
  ): { partyId: string } {
    const selfMember = this.validateCustomGame(party, selfPuuid);
    this.assertOwner(selfMember);
    return { partyId: party!.ID };
  }

  static validateSetPreferredServers(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
    ids: string[],
    validPods: string[],
  ): { partyId: string; gamePodIds: string[] } {
    if (!party || !party.ID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }
    const selfMember = (party.Members ?? []).find((m) => m.Subject === selfPuuid);
    if (!selfMember) {
      throw new ValidationError("not-a-member", "Caller is not a member of the party");
    }
    this.assertOwner(selfMember);
    const validSet = new Set(validPods.map((p) => p.toLowerCase()));
    for (const id of ids) {
      if (!validSet.has(id.toLowerCase())) {
        throw new ValidationError("server-unknown", `Server '${id}' is unknown`, { server: id });
      }
    }
    return { partyId: party.ID, gamePodIds: ids };
  }

  static validateSetModerator(
    party: RiotPartyResponse | null | undefined,
    selfPuuid: string,
    targetPuuid: string,
    isModerator: boolean,
  ): { partyId: string; puuid: string; isModerator: boolean } {
    if (!party || !party.ID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }
    const selfMember = (party.Members ?? []).find((m) => m.Subject === selfPuuid);
    if (!selfMember) {
      throw new ValidationError("not-a-member", "Caller is not a member of the party");
    }
    this.assertOwner(selfMember);
    const exists = party.Members.some((m) => m.Subject === targetPuuid);
    if (!exists) {
      throw new ValidationError("not-a-member", "Player is not a member of the party", {
        puuid: targetPuuid,
      });
    }
    return { partyId: party.ID, puuid: targetPuuid, isModerator };
  }
}

export function normalizeCustomGameTeam(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower === "teamone" || lower === "one" || lower === "1" || lower === "blue") return "TeamOne";
  if (lower === "teamtwo" || lower === "two" || lower === "2" || lower === "red") return "TeamTwo";
  if (lower === "teamspectate" || lower === "spectate" || lower === "spec") return "TeamSpectate";
  if (
    lower === "teamonecoaches" ||
    lower === "onecoaches" ||
    lower === "coachone" ||
    lower === "coach1"
  )
    return "TeamOneCoaches";
  if (
    lower === "teamtwocoaches" ||
    lower === "twocoaches" ||
    lower === "coachtwo" ||
    lower === "coach2"
  )
    return "TeamTwoCoaches";
  throw new ValidationError("invalid-argument", `Unknown custom game team: ${raw}`);
}
