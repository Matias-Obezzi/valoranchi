import { PartyBuilder } from "../collection/PartyBuilder.js";
import { ValidationError } from "../errors.js";
import type { Party } from "../model/index.js";
import type { RiotApi } from "../riot/RiotApi.js";
import { ChatValidator } from "./ChatValidator.js";
import type { ClientContext } from "./ClientContext.js";
import type { PartyApi } from "./api.js";
import { resolveLobbyNames } from "./LiveMatchService.js";
import { PartyValidator, type PartyAction, type PartyActionRequest } from "./PartyValidator.js";

export class PartyService implements PartyApi {
  constructor(private readonly context: ClientContext) {}

  async current(): Promise<Party> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID) {
      return null;
    }
    const [rawParty, catalogue] = await Promise.all([
      api.party(partyPlayer.CurrentPartyID),
      this.context.catalogue(),
    ]);
    const puuids = (rawParty.Members ?? []).map((m) => m.Subject);
    const names = await resolveLobbyNames(api, puuids);
    return new PartyBuilder(catalogue).build(rawParty, names);
  }

  private async validateAction(action: PartyAction): Promise<PartyActionRequest> {
    PartyValidator.validateActionParameters(action);
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }
    const rawParty = await api.party(partyPlayer.CurrentPartyID);
    return PartyValidator.validate(rawParty, session.puuid, action);
  }

  async validateInvite(riotId: string): Promise<PartyActionRequest> {
    return this.validateAction({ type: "invite", riotId });
  }

  async validateKick(puuid: string): Promise<PartyActionRequest> {
    return this.validateAction({ type: "kick", puuid });
  }

  async validatePromote(puuid: string): Promise<PartyActionRequest> {
    return this.validateAction({ type: "promote", puuid });
  }

  async validateCreateInviteCode(): Promise<PartyActionRequest> {
    return this.validateAction({ type: "create-invite-code" });
  }

  async validateRevokeInviteCode(): Promise<PartyActionRequest> {
    return this.validateAction({ type: "revoke-invite-code" });
  }

  async validateJoinByCode(code: string): Promise<PartyActionRequest> {
    return this.validateAction({ type: "join-by-code", code });
  }

  async validateSetReady(ready: boolean): Promise<PartyActionRequest> {
    return this.validateAction({ type: "set-ready", ready });
  }

  async validateSetQueue(queue: string): Promise<PartyActionRequest> {
    return this.validateAction({ type: "set-queue", queue });
  }

  async validateSetAccessibility(accessibility: "open" | "closed"): Promise<PartyActionRequest> {
    return this.validateAction({ type: "set-accessibility", accessibility });
  }

  async validateStartMatchmaking(): Promise<PartyActionRequest> {
    return this.validateAction({ type: "start-matchmaking" });
  }

  async validateStopMatchmaking(): Promise<PartyActionRequest> {
    return this.validateAction({ type: "stop-matchmaking" });
  }

  async validateLeave(): Promise<PartyActionRequest> {
    return this.validateAction({ type: "leave" });
  }

  async invite(riotId: string): Promise<Party> {
    await this.executeAction({ type: "invite", riotId });
    return this.current();
  }

  async kick(puuid: string): Promise<Party> {
    await this.executeAction({ type: "kick", puuid });
    return this.current();
  }

  async promote(puuid: string): Promise<Party> {
    await this.executeAction({ type: "promote", puuid });
    return this.current();
  }

  async createInviteCode(): Promise<Party> {
    await this.executeAction({ type: "create-invite-code" });
    return this.current();
  }

  async revokeInviteCode(): Promise<Party> {
    await this.executeAction({ type: "revoke-invite-code" });
    return this.current();
  }

  async joinByCode(code: string): Promise<Party> {
    await this.executeAction({ type: "join-by-code", code });
    return this.current();
  }

  async setReady(ready: boolean): Promise<Party> {
    await this.executeAction({ type: "set-ready", ready });
    return this.current();
  }

  async setQueue(queue: string): Promise<Party> {
    await this.executeAction({ type: "set-queue", queue });
    return this.current();
  }

  async setAccessibility(accessibility: "open" | "closed"): Promise<Party> {
    await this.executeAction({ type: "set-accessibility", accessibility });
    return this.current();
  }

  async startMatchmaking(): Promise<Party> {
    await this.executeAction({ type: "start-matchmaking" });
    return this.current();
  }

  async stopMatchmaking(): Promise<Party> {
    await this.executeAction({ type: "stop-matchmaking" });
    return this.current();
  }

  async leave(): Promise<Party> {
    await this.executeAction({ type: "leave" });
    return this.current();
  }

  private async executeAction(action: PartyAction): Promise<void> {
    PartyValidator.validateActionParameters(action);
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }
    const rawParty = await api.party(partyPlayer.CurrentPartyID);
    PartyValidator.validate(rawParty, session.puuid, action);
    await this.performAction(api, partyPlayer.CurrentPartyID, session.puuid, action);
  }

  private async performAction(
    api: RiotApi,
    partyId: string,
    selfPuuid: string,
    action: PartyAction,
  ): Promise<void> {
    switch (action.type) {
      case "invite": {
        const { gameName, gameTag } = ChatValidator.parseRiotId(action.riotId);
        await api.inviteToParty(partyId, gameName, gameTag);
        break;
      }
      case "kick":
        await api.kickFromParty(partyId, action.puuid);
        break;
      case "promote":
        await api.promotePartyMember(partyId, action.puuid);
        break;
      case "create-invite-code":
        await api.createPartyInviteCode(partyId);
        break;
      case "revoke-invite-code":
        await api.revokePartyInviteCode(partyId);
        break;
      case "join-by-code":
        await api.joinPartyByCode(action.code);
        break;
      case "set-ready":
        await api.setPartyReady(partyId, selfPuuid, action.ready);
        break;
      case "set-queue":
        await api.setPartyQueue(partyId, action.queue);
        break;
      case "set-accessibility":
        await api.setPartyAccessibility(
          partyId,
          action.accessibility === "open" ? "OPEN" : "CLOSED",
        );
        break;
      case "start-matchmaking":
        await api.startPartyMatchmaking(partyId);
        break;
      case "stop-matchmaking":
        await api.stopPartyMatchmaking(partyId);
        break;
      case "leave":
        await api.leaveParty(selfPuuid);
        break;
    }
  }
}
