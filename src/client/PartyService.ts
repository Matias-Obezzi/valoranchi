import { CustomGameConfigsBuilder } from "../collection/CustomGameConfigsBuilder.js";
import { PartyBuilder } from "../collection/PartyBuilder.js";
import { QueueConfigBuilder } from "../collection/QueueConfigBuilder.js";
import { ValidationError } from "../errors.js";
import type {
  CustomGameConfigs,
  CustomGameSettings,
  Party,
  PartyInvite,
  PartyRequest,
  QueueConfig,
} from "../model/index.js";
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

  async queues(): Promise<QueueConfig[]> {
    const session = await this.context.sessions.session();
    const raw = await this.context.api(session).queueConfigs();
    return QueueConfigBuilder.build(raw);
  }

  async customGameConfigs(): Promise<CustomGameConfigs> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const [raw, catalogue, partyPlayer] = await Promise.all([
      api.customGameConfigs(),
      this.context.catalogue(),
      api.partyPlayer(),
    ]);
    return CustomGameConfigsBuilder.build(raw, catalogue, partyPlayer?.PingMap);
  }

  async validateJoin(partyId: string): Promise<{ partyId: string }> {
    const session = await this.context.sessions.session();
    const partyPlayer = await this.context.api(session).partyPlayer();
    return PartyValidator.validateJoin(partyPlayer, partyId);
  }

  async join(partyId: string): Promise<Party> {
    const validated = await this.validateJoin(partyId);
    const session = await this.context.sessions.session();
    await this.context.api(session).joinParty(validated.partyId, session.puuid);
    return this.current();
  }

  async validateDeclineInvite(inviteId: string): Promise<{ partyId: string; inviteId: string }> {
    const session = await this.context.sessions.session();
    const partyPlayer = await this.context.api(session).partyPlayer();
    return PartyValidator.validateDeclineInvite(partyPlayer, inviteId);
  }

  async declineInvite(inviteId: string): Promise<{ declined: boolean; inviteId: string }> {
    const validated = await this.validateDeclineInvite(inviteId);
    const session = await this.context.sessions.session();
    await this.context.api(session).declinePartyInvite(validated.partyId, validated.inviteId);
    return { declined: true, inviteId };
  }

  async validateRequestToJoin(
    partyId: string,
  ): Promise<{ method: string; path: string; body: unknown }> {
    const session = await this.context.sessions.session();
    return {
      method: "POST",
      path: `/parties/v1/parties/${encodeURIComponent(partyId)}/request`,
      body: { Subjects: [session.puuid] },
    };
  }

  async requestToJoin(partyId: string): Promise<{ requested: boolean; partyId: string }> {
    await this.validateRequestToJoin(partyId);
    const session = await this.context.sessions.session();
    await this.context.api(session).requestPartyJoin(partyId, session.puuid);
    return { requested: true, partyId };
  }

  async validateDeclineRequest(requestId: string): Promise<{ partyId: string; requestId: string }> {
    const session = await this.context.sessions.session();
    const partyPlayer = await this.context.api(session).partyPlayer();
    if (!partyPlayer?.CurrentPartyID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }
    const rawParty = await this.context.api(session).party(partyPlayer.CurrentPartyID);
    return PartyValidator.validateDeclineRequest(rawParty, session.puuid, requestId);
  }

  async declineRequest(requestId: string): Promise<{ declined: boolean; requestId: string }> {
    const validated = await this.validateDeclineRequest(requestId);
    const session = await this.context.sessions.session();
    await this.context.api(session).declinePartyRequest(validated.partyId, validated.requestId);
    return { declined: true, requestId };
  }

  async invites(): Promise<PartyInvite[]> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    const rawInvites = partyPlayer?.Invites ?? [];
    const puuids = rawInvites.map((i) => i.RequestedBy).filter((p): p is string => Boolean(p));
    const names = await resolveLobbyNames(api, puuids);
    return rawInvites.map((i) => {
      const nameInfo = i.RequestedBy ? names.get(i.RequestedBy) : undefined;
      return {
        id: i.ID,
        partyId: i.PartyID,
        from: i.RequestedBy
          ? {
              puuid: i.RequestedBy,
              gameName: nameInfo?.gameName ?? "",
              tagLine: nameInfo?.tagLine ?? "",
            }
          : null,
        at: i.CreatedAt ? new Date(i.CreatedAt).toISOString() : new Date().toISOString(),
      };
    });
  }

  async requests(): Promise<PartyRequest[]> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID) return [];
    const rawParty = await api.party(partyPlayer.CurrentPartyID);
    const rawReqs = rawParty.Requests ?? [];
    const puuids = rawReqs.map((r) => r.RequestedBy).filter((p): p is string => Boolean(p));
    const names = await resolveLobbyNames(api, puuids);
    return rawReqs.map((r) => {
      const nameInfo = r.RequestedBy ? names.get(r.RequestedBy) : undefined;
      return {
        id: r.ID,
        from: r.RequestedBy
          ? {
              puuid: r.RequestedBy,
              gameName: nameInfo?.gameName ?? "",
              tagLine: nameInfo?.tagLine ?? "",
            }
          : null,
        at: r.CreatedAt ? new Date(r.CreatedAt).toISOString() : new Date().toISOString(),
      };
    });
  }

  async validateMakeCustomGame(): Promise<{ partyId: string }> {
    const session = await this.context.sessions.session();
    const partyPlayer = await this.context.api(session).partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    const party = await this.context.api(session).party(partyPlayer.CurrentPartyID);
    const member = (party.Members ?? []).find((m) => m.Subject === session.puuid);
    if (!member?.IsOwner) throw new ValidationError("not-owner", "Caller is not the party owner");
    return { partyId: party.ID };
  }

  async makeCustomGame(): Promise<Party> {
    const validated = await this.validateMakeCustomGame();
    const session = await this.context.sessions.session();
    await this.context.api(session).makePartyCustomGame(validated.partyId);
    return this.current();
  }

  async validateMakeDefault(queue: string): Promise<{ partyId: string; queue: string }> {
    const session = await this.context.sessions.session();
    const partyPlayer = await this.context.api(session).partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    const party = await this.context.api(session).party(partyPlayer.CurrentPartyID);
    const member = (party.Members ?? []).find((m) => m.Subject === session.puuid);
    if (!member?.IsOwner) throw new ValidationError("not-owner", "Caller is not the party owner");
    return { partyId: party.ID, queue };
  }

  async makeDefault(queue: string): Promise<Party> {
    const validated = await this.validateMakeDefault(queue);
    const session = await this.context.sessions.session();
    await this.context.api(session).makePartyDefault(validated.partyId, validated.queue);
    return this.current();
  }

  async validateSetCustomGameSettings(
    settings: CustomGameSettings,
  ): Promise<Record<string, unknown>> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    const [party, configs, catalogue] = await Promise.all([
      api.party(partyPlayer.CurrentPartyID),
      api.customGameConfigs(),
      this.context.catalogue(),
    ]);
    return PartyValidator.validateSetCustomGameSettings(
      party,
      session.puuid,
      settings,
      configs,
      catalogue,
    );
  }

  async setCustomGameSettings(settings: CustomGameSettings): Promise<Party> {
    const payload = await this.validateSetCustomGameSettings(settings);
    const session = await this.context.sessions.session();
    const partyPlayer = await this.context.api(session).partyPlayer();
    await this.context
      .api(session)
      .setPartyCustomGameSettings(partyPlayer!.CurrentPartyID, payload);
    return this.current();
  }

  async validateSetTeam(
    puuid: string,
    team: string,
  ): Promise<{ partyId: string; team: string; puuid: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    const party = await api.party(partyPlayer.CurrentPartyID);
    return PartyValidator.validateSetTeam(party, session.puuid, puuid, team);
  }

  async setTeam(puuid: string, team: string): Promise<Party> {
    const validated = await this.validateSetTeam(puuid, team);
    const session = await this.context.sessions.session();
    await this.context
      .api(session)
      .setPartyCustomGameTeam(validated.partyId, validated.team, validated.puuid);
    return this.current();
  }

  async validateStartCustomGame(): Promise<{ partyId: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    const party = await api.party(partyPlayer.CurrentPartyID);
    return PartyValidator.validateStartCustomGame(party, session.puuid);
  }

  async startCustomGame(): Promise<Party> {
    const validated = await this.validateStartCustomGame();
    const session = await this.context.sessions.session();
    await this.context.api(session).startPartyCustomGame(validated.partyId);
    return this.current();
  }

  async validateBalanceTeams(): Promise<{ partyId: string }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    const party = await api.party(partyPlayer.CurrentPartyID);
    return PartyValidator.validateBalanceTeams(party, session.puuid);
  }

  async balanceTeams(): Promise<Party> {
    const validated = await this.validateBalanceTeams();
    const session = await this.context.sessions.session();
    await this.context.api(session).balancePartyTeams(validated.partyId);
    return this.current();
  }

  async validateSetPreferredServers(
    ids: string[],
  ): Promise<{ partyId: string; gamePodIds: string[] }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    const [party, configs] = await Promise.all([
      api.party(partyPlayer.CurrentPartyID),
      api.customGameConfigs(),
    ]);
    const validPods = [
      ...Object.keys(partyPlayer.PingMap ?? {}),
      ...Object.keys((configs.GamePodPingServiceInfo as Record<string, unknown>) ?? {}),
    ];
    return PartyValidator.validateSetPreferredServers(party, session.puuid, ids, validPods);
  }

  async setPreferredServers(ids: string[]): Promise<Party> {
    const validated = await this.validateSetPreferredServers(ids);
    const session = await this.context.sessions.session();
    await this.context.api(session).setPreferredGamePods(validated.partyId, validated.gamePodIds);
    return this.current();
  }

  async validateSetModerator(
    puuid: string,
    isModerator: boolean,
  ): Promise<{ partyId: string; puuid: string; isModerator: boolean }> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    const party = await api.party(partyPlayer.CurrentPartyID);
    return PartyValidator.validateSetModerator(party, session.puuid, puuid, isModerator);
  }

  async setModerator(puuid: string, isModerator: boolean): Promise<Party> {
    const validated = await this.validateSetModerator(puuid, isModerator);
    const session = await this.context.sessions.session();
    await this.context
      .api(session)
      .setPlayerModeratorStatus(validated.partyId, validated.puuid, validated.isModerator);
    return this.current();
  }

  async validateRefresh(): Promise<{ method: string; paths: string[] }> {
    const session = await this.context.sessions.session();
    const partyPlayer = await this.context.api(session).partyPlayer();
    if (!partyPlayer?.CurrentPartyID) {
      throw new ValidationError("no-party", "Not currently in a party");
    }
    return {
      method: "POST",
      paths: [
        `/parties/v1/parties/members/${encodeURIComponent(session.puuid)}/refreshPings`,
        `/parties/v1/parties/members/${encodeURIComponent(session.puuid)}/refreshCompetitiveTier`,
        `/parties/v1/parties/members/${encodeURIComponent(session.puuid)}/refreshPlayerIdentity`,
      ],
    };
  }

  async refresh(): Promise<Party> {
    const session = await this.context.sessions.session();
    const api = this.context.api(session);
    const partyPlayer = await api.partyPlayer();
    if (!partyPlayer?.CurrentPartyID)
      throw new ValidationError("no-party", "Not currently in a party");
    await Promise.all([
      api.refreshPartyPings(partyPlayer.CurrentPartyID, session.puuid),
      api.refreshPartyCompetitiveTier(partyPlayer.CurrentPartyID, session.puuid),
      api.refreshPartyPlayerIdentity(partyPlayer.CurrentPartyID, session.puuid),
    ]);
    return this.current();
  }
}
