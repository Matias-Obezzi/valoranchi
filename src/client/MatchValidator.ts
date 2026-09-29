import type { Catalogue } from "../catalogue/Catalogue.js";
import { ValidationError } from "../errors.js";
import {
  ENTITLEMENT_ITEM_TYPES,
  type RiotCoreGamePlayerResponse,
  type RiotEntitlementsResponse,
  type RiotPregameMatchResponse,
  type RiotPregamePlayerResponse,
} from "../riot/types.js";

export class MatchValidator {
  static validateSelectOrLock(
    pregameMatch: RiotPregameMatchResponse | null | undefined,
    catalogue: Catalogue,
    entitlements: RiotEntitlementsResponse,
    agentQuery: string,
    selfPuuid: string,
    action: "select" | "lock" = "select",
  ): { method: string; path: string; matchId: string; agentUuid: string } {
    if (!pregameMatch || !pregameMatch.ID) {
      throw new ValidationError("not-in-pregame", "Not currently in pregame agent select");
    }

    const agent = catalogue.findAgent(agentQuery) ?? catalogue.getAgent(agentQuery);
    if (!agent || !agent.isPlayableCharacter) {
      throw new ValidationError("unknown-agent", `Unknown or non-playable agent: ${agentQuery}`, {
        agent: agentQuery,
      });
    }

    this.assertAgentOwned(agent.uuid, agent.displayName, agent.isBaseContent, entitlements);
    this.assertNotLockedByAlly(pregameMatch, agent.uuid, selfPuuid);
    this.assertSelfNotLocked(pregameMatch, selfPuuid);

    return {
      method: "POST",
      path: `/pregame/v1/matches/${encodeURIComponent(pregameMatch.ID)}/${action}/${encodeURIComponent(agent.uuid)}`,
      matchId: pregameMatch.ID,
      agentUuid: agent.uuid,
    };
  }

  private static assertAgentOwned(
    agentUuid: string,
    agentName: string,
    isBaseContent: boolean | undefined,
    entitlements: RiotEntitlementsResponse,
  ): void {
    if (isBaseContent) {
      return;
    }
    const agentEntitlements = entitlements.EntitlementsByTypes?.find(
      (e) => e.ItemTypeID === ENTITLEMENT_ITEM_TYPES.agent,
    );
    const owned = agentEntitlements?.Entitlements?.some(
      (e) => e.ItemID.toLowerCase() === agentUuid.toLowerCase(),
    );
    if (!owned) {
      throw new ValidationError("agent-not-owned", `Agent '${agentName}' is not owned`, {
        agent: agentUuid,
      });
    }
  }

  private static assertNotLockedByAlly(
    pregameMatch: RiotPregameMatchResponse,
    agentUuid: string,
    selfPuuid: string,
  ): void {
    const allyPlayers = pregameMatch.AllyTeam?.Players ?? [];
    const lockedByAlly = allyPlayers.some(
      (p) =>
        p.Subject !== selfPuuid &&
        p.CharacterID?.toLowerCase() === agentUuid.toLowerCase() &&
        p.CharacterSelectionState === "locked",
    );
    if (lockedByAlly) {
      throw new ValidationError("agent-locked-by-ally", "Agent is already locked by an ally", {
        agent: agentUuid,
      });
    }
  }

  private static assertSelfNotLocked(
    pregameMatch: RiotPregameMatchResponse,
    selfPuuid: string,
  ): void {
    const selfPlayer = (pregameMatch.AllyTeam?.Players ?? []).find((p) => p.Subject === selfPuuid);
    if (selfPlayer?.CharacterSelectionState === "locked") {
      throw new ValidationError("already-locked", "Agent selection is already locked");
    }
  }

  static validateDodge(
    pregamePlayer: RiotPregamePlayerResponse | null | undefined,
    options?: { confirm?: boolean },
  ): { method: string; path: string; matchId: string } {
    if (options?.confirm !== true) {
      throw new ValidationError(
        "confirm-required",
        "Dodge requires explicit confirmation as Riot penalises it",
      );
    }
    if (!pregamePlayer?.MatchID) {
      throw new ValidationError("not-in-pregame", "Not currently in pregame agent select");
    }
    return {
      method: "POST",
      path: `/pregame/v1/matches/${encodeURIComponent(pregamePlayer.MatchID)}/quit`,
      matchId: pregamePlayer.MatchID,
    };
  }

  static validateLeaveMatch(
    corePlayer: RiotCoreGamePlayerResponse | null | undefined,
    selfPuuid: string,
    options?: { confirm?: boolean },
  ): { method: string; path: string; matchId: string; puuid: string } {
    if (options?.confirm !== true) {
      throw new ValidationError("confirm-required", "Leaving match requires explicit confirmation");
    }
    if (!corePlayer?.MatchID) {
      throw new ValidationError("not-in-match", "Not currently in a match");
    }
    return {
      method: "POST",
      path: `/core-game/v1/players/${encodeURIComponent(selfPuuid)}/disassociate/${encodeURIComponent(corePlayer.MatchID)}`,
      matchId: corePlayer.MatchID,
      puuid: selfPuuid,
    };
  }
}
